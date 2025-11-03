// app/api/liquidity/add/route.ts
import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import BN from "bn.js";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

const solanaConnection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || "https://api.devnet.solana.com",
  "confirmed" // Use "confirmed" for faster response
);

export async function POST(req: Request) {
  try {
    // --- AUTH ---
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorizationHeader.split(" ")[1];
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err: any) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const creatorProfileId = decodedToken.id;

    // --- BODY ---
    const body = await req.json();
    const {
      communityId,
      lbPairAddress,
      tokenXAmount,
      tokenYAmount,
      userPublicKey,
      slippageBps = 100,
    } = body;

    console.log("Required parameters:", {
      communityId,
      lbPairAddress,
      tokenXAmount,
      tokenYAmount,
      userPublicKey,
      slippageBps
    });

    if (
      !communityId ||
      !lbPairAddress ||
      tokenXAmount == null ||
      tokenYAmount == null ||
      !userPublicKey
    ) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // --- COMMUNITY CHECK ---
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("creator_id, meteora_lb_pair_address")
      .eq("id", communityId)
      .single();

    if (error || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (community.creator_id !== creatorProfileId) {
      return NextResponse.json({ error: "Only the community creator can add liquidity" }, { status: 403 });
    }

    if (community.meteora_lb_pair_address !== lbPairAddress) {
      return NextResponse.json({ error: "LB pair address mismatch" }, { status: 400 });
    }

    console.log("Building add liquidity transaction...");

    const ownerPubkey = new PublicKey(userPublicKey);
    const lbPair = new PublicKey(lbPairAddress);

    // --- IMPROVED: Wait for LB Pair account with exponential backoff ---
    let accountFound = false;
    const maxRetries = 40; // Increased retries
    let retries = 0;
    
    console.log(`Waiting for LB Pair account ${lbPairAddress} to be available...`);
    
    while (!accountFound && retries < maxRetries) {
      try {
        // Use 'confirmed' commitment for faster detection
        const acc = await solanaConnection.getAccountInfo(lbPair, 'confirmed');
        if (acc && acc.data.length > 0) {
          console.log(`✅ LB Pair account found after ${retries} retries`);
          console.log(`   Account owner: ${acc.owner.toBase58()}`);
          console.log(`   Account data length: ${acc.data.length} bytes`);
          accountFound = true;
          break;
        }
      } catch (error: any) {
        console.log(`Retry ${retries + 1}/${maxRetries}: ${error.message}`);
      }
      
      // Exponential backoff: start with 1s, increase to 3s after 10 tries
      const delayMs = retries < 10 ? 1000 : retries < 20 ? 2000 : 3000;
      await new Promise(res => setTimeout(res, delayMs));
      retries++;
      
      // Log progress
      if (retries % 5 === 0) {
        console.log(`⏳ Still waiting for LB Pair account... (${retries}/${maxRetries} attempts)`);
      }
    }
    
    if (!accountFound) {
      const totalWaitTime = Math.floor((10 * 1 + 10 * 2 + (retries - 20) * 3));
      console.error(`❌ LB Pair account ${lbPairAddress} not found after ${retries} retries (~${totalWaitTime}s)`);
      return NextResponse.json({ 
        error: `LB Pair account not found after waiting ~${totalWaitTime} seconds. The pool may still be propagating on Solana devnet. Please wait 1-2 minutes and try adding liquidity again from the community page.`,
        suggestion: "You can manually add liquidity later once the pool is fully propagated.",
        lbPairAddress
      }, { status: 504 });
    }

    // Additional wait to ensure full propagation
    console.log("✅ Account found! Waiting 3 seconds for full propagation...");
    await new Promise(res => setTimeout(res, 3000));

    // Initialize DLMM instance
    console.log("🔄 Initializing DLMM instance...");
    let dlmmPool;
    try {
      dlmmPool = await DLMM.create(solanaConnection, lbPair, {
        cluster: "devnet",
      });
      console.log("✅ DLMM instance created successfully");
    } catch (dlmmError: any) {
      console.error("❌ Error creating DLMM instance:", dlmmError);
      return NextResponse.json({ 
        error: `Failed to initialize DLMM pool: ${dlmmError.message}. The pool account exists but may not be fully initialized yet. Please try again in a moment.`,
        lbPairAddress
      }, { status: 500 });
    }

    // Get the active bin (current price point)
    console.log("📊 Fetching active bin...");
    let activeBin;
    try {
      activeBin = await dlmmPool.getActiveBin();
      console.log(`✅ Active bin ID: ${activeBin.binId}`);
    } catch (binError: any) {
      console.error("❌ Error fetching active bin:", binError);
      return NextResponse.json({
        error: `Failed to fetch active bin: ${binError.message}. The pool may not be fully initialized yet.`,
        lbPairAddress
      }, { status: 500 });
    }

    const activeId = activeBin.binId;

    // Define liquidity distribution strategy
    const minBinId = activeId - 10; // 10 bins below
    const maxBinId = activeId + 10; // 10 bins above

    console.log(`💧 Creating position with liquidity distribution: bins ${minBinId} to ${maxBinId}`);

    // Create position with balanced distribution
    let createPositionTx;
    try {
      createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: ownerPubkey,
        user: ownerPubkey,
        totalXAmount: new BN(tokenXAmount),
        totalYAmount: new BN(tokenYAmount),
        strategy: {
          maxBinId,
          minBinId,
          strategyType: "SpotBalanced",
        },
        slippage: slippageBps / 10000,
      });
      console.log("✅ Position transaction created");
    } catch (posError: any) {
      console.error("❌ Error creating position:", posError);
      return NextResponse.json({
        error: `Failed to create position: ${posError.message}`,
        lbPairAddress
      }, { status: 500 });
    }

    // Add recent blockhash
    const { blockhash } = await solanaConnection.getLatestBlockhash("finalized");
    createPositionTx.recentBlockhash = blockhash;
    createPositionTx.feePayer = ownerPubkey;

    // Serialize transaction
    const serialized = createPositionTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    console.log("✅ Add liquidity transaction prepared successfully");

    return NextResponse.json(
      {
        serializedTransaction: bs58.encode(serialized),
        message: "Unsigned add liquidity transaction ready. Sign & send on frontend.",
        activeBinId: activeId,
        minBinId,
        maxBinId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ /api/liquidity/add error:", err);
    return NextResponse.json(
      {
        error: err?.message || String(err),
        details: err?.stack,
      },
      { status: 500 }
    );
  }
}