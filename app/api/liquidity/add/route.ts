// app/api/liquidity/add/route.ts
import DLMM from "@meteora-ag/dlmm";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
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
      .select("creator_id, meteora_lb_pair_address, token_mint_address")
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
    const BIN_SPREAD = 5;

    // 1. Core Token Definitions & Validation
    const tokenX = dlmmPool.tokenX.publicKey;
    const tokenY = dlmmPool.tokenY.publicKey;
    const communityMint = new PublicKey(community.token_mint_address);

    // 2. Check for WSOL ATA (Interceptive)
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
    if (tokenX.equals(WSOL) || tokenY.equals(WSOL)) {
        const ata = await getAssociatedTokenAddress(WSOL, ownerPubkey);
        const ataAccount = await solanaConnection.getAccountInfo(ata);
        
        if (!ataAccount) {
            console.log("⚠️ WSOL ATA missing. Returning transaction to create it.");
            const ix = createAssociatedTokenAccountInstruction(
                ownerPubkey,
                ata,
                ownerPubkey,
                WSOL
            );
            const tx = new Transaction().add(ix);
            const { blockhash } = await solanaConnection.getLatestBlockhash("finalized");
            tx.recentBlockhash = blockhash;
            tx.feePayer = ownerPubkey;
            
            const serialized = tx.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
            });
            
            return NextResponse.json({
                action: "CREATE_WSOL_ATA",
                serializedTransaction: bs58.encode(serialized),
                message: "WSOL Account missing. Please sign to create it first."
            });
        }
    }

    // 3. Define Strategy & Amounts (Universal Fix)
    let finalXAmount = new BN(0);
    let finalYAmount = new BN(0);

    // Initial Mapping: purely based on mint identity
    if (communityMint.equals(tokenX)) {
        finalXAmount = new BN(tokenXAmount);
        finalYAmount = new BN(tokenYAmount);
    } else if (communityMint.equals(tokenY)) {
        finalXAmount = new BN(tokenYAmount); 
        finalYAmount = new BN(tokenXAmount);
    } else {
        throw new Error("Community token mint does not match pool tokenX or tokenY");
    }
    
    // Select Strategy based on Active Bin & Amounts
    let strategy;

   if (activeId === 0) {
  // ✅ BOOTSTRAP CASE: Auto-select the community token (non-SOL) for bootstrap
  console.log('🚀 Bootstrap mode detected (activeBinId = 0)');
  
  if (finalXAmount.isZero() && finalYAmount.isZero()) {
    throw new Error("Liquidity amount cannot be zero for both tokens");
  }

  // If both amounts provided, automatically choose the community token
  if (finalXAmount.gt(new BN(0)) && finalYAmount.gt(new BN(0))) {
    console.log('⚠️ Both tokens provided at bootstrap. Auto-selecting community token...');
    
    // Determine which is the community token and keep only that one
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
    
    if (tokenX.equals(communityMint)) {
      // Community token is X, keep X and zero out Y
      console.log(`✅ Bootstrapping with Token X (community token): ${finalXAmount.toString()}`);
      finalYAmount = new BN(0);
    } else if (tokenY.equals(communityMint)) {
      // Community token is Y, keep Y and zero out X
      console.log(`✅ Bootstrapping with Token Y (community token): ${finalYAmount.toString()}`);
      finalXAmount = new BN(0);
    } else {
      // Fallback: if neither is explicitly the community token, prefer non-SOL
      if (tokenX.equals(WSOL)) {
        console.log(`✅ Bootstrapping with Token Y (non-SOL): ${finalYAmount.toString()}`);
        finalXAmount = new BN(0);
      } else {
        console.log(`✅ Bootstrapping with Token X (non-SOL): ${finalXAmount.toString()}`);
        finalYAmount = new BN(0);
      }
    }
  }

  strategy = {
    strategyType: "SpotOneSide" as any,
    minBinId: 0,
    maxBinId: BIN_SPREAD,
  };
}
else {
        // Standard Logic (Active Bin > 0)
        if (finalXAmount.gt(new BN(0)) && finalYAmount.isZero()) {
             // Token X only → ABOVE price
             strategy = {
                strategyType: "SpotOneSide" as any,
                minBinId: activeId + 1,
                maxBinId: activeId + BIN_SPREAD,
             };
        } else if (finalYAmount.gt(new BN(0)) && finalXAmount.isZero()) {
             // Token Y only → BELOW price
             strategy = {
                strategyType: "SpotOneSide" as any,
                minBinId: Math.max(0, activeId - BIN_SPREAD),
                maxBinId: activeId - 1,
             };
         } else {
             // Both tokens → Balanced liquidity
             strategy = {
                strategyType: "SpotBalanced" as any,
                minBinId: activeId - BIN_SPREAD,
                maxBinId: activeId + BIN_SPREAD,
             };
         }
    }

    // 🧪 SAFETY CHECK: Log all strategy parameters before transaction
    console.log('🔍 Strategy Safety Check:', {
      activeId,
      strategy: strategy.strategyType,
      minBinId: strategy.minBinId,
      maxBinId: strategy.maxBinId,
      X: finalXAmount.toString(),
      Y: finalYAmount.toString(),
    });
    console.log(`💧 Creating position with strategy: ${strategy.strategyType} [${strategy.minBinId}, ${strategy.maxBinId}]`);
    console.log(`   Amounts: X=${finalXAmount.toString()} Y=${finalYAmount.toString()}`);

    let createPositionTx;
    try {
      const positionKeypair = Keypair.generate();

      createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: positionKeypair.publicKey,
        user: ownerPubkey,
        totalXAmount: finalXAmount,
        totalYAmount: finalYAmount,
        strategy: strategy, // Passed directly, not nested
        slippage: slippageBps / 10000,
      });

      // IMPORTANT: The new position account Keypair must verify the initialization
      createPositionTx.partialSign(positionKeypair);
      
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
        minBinId: strategy.minBinId,
        maxBinId: strategy.maxBinId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (String(err).includes("failed to get info about account")) {
       console.error("RPC Fetch Error in DLMM:", err);
       return NextResponse.json({
           error: "RPC node failed to fetch account info. Please try again.",
           details: String(err)
       }, { status: 503 });
    }

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
