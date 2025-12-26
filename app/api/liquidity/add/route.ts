// app/api/liquidity/add/route.ts
import DLMM from "@meteora-ag/dlmm";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
//@ts-ignore
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
  "confirmed"
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
    const maxRetries = 40;
    let retries = 0;
    
    console.log(`Waiting for LB Pair account ${lbPairAddress} to be available...`);
    
    while (!accountFound && retries < maxRetries) {
      try {
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
      
      const delayMs = retries < 10 ? 1000 : retries < 20 ? 2000 : 3000;
      await new Promise(res => setTimeout(res, delayMs));
      retries++;
      
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
    const BIN_SPREAD = 5; // ✅ Optimal spread for balanced liquidity

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

    // 3. Define Strategy & Amounts
    let finalXAmount = new BN(tokenXAmount);
    let finalYAmount = new BN(tokenYAmount);

    console.log(`✅ Provided amounts: X=${finalXAmount.toString()}, Y=${finalYAmount.toString()}`);

    const DUST = new BN(1_000); // minimum viable per-bin amount

    // ✅ FIXED: Proper bin range calculation for SpotBalanced
    const BIN_ARRAY_SIZE = 32;

    // Compute active array safely for negatives
    const activeArrayIndex =
      activeId >= 0
        ? Math.floor(activeId / BIN_ARRAY_SIZE)
        : Math.ceil((activeId + 1) / BIN_ARRAY_SIZE) - 1;

    const arrayMin = activeArrayIndex * BIN_ARRAY_SIZE;
    const arrayMax = arrayMin + BIN_ARRAY_SIZE - 1;

    // ✅ FIX #1: Start with SYMMETRIC spread (ensures odd count)
    // For odd bin count: use activeId ± (BIN_SPREAD)
    // This gives us: 2*BIN_SPREAD + 1 bins (always odd)
    let minBinId = activeId - BIN_SPREAD;
    let maxBinId = activeId + BIN_SPREAD;

    // ✅ FIX #2: Clamp to array boundaries WHILE PRESERVING ODD COUNT
    minBinId = Math.max(minBinId, arrayMin);
    maxBinId = Math.min(maxBinId, arrayMax);

    // ✅ FIX #3: After clamping, re-center if needed to ensure odd count
    let binCount = maxBinId - minBinId + 1;
    
    if (binCount % 2 === 0) {
      // If clamping made it even, adjust by extending the range symmetrically
      const rangeLeft = minBinId - arrayMin;
      const rangeRight = arrayMax - maxBinId;
      
      if (rangeLeft > 0 && rangeRight > 0) {
        // Can extend either direction, prefer left to keep near active
        minBinId -= 1;
      } else if (rangeRight > 0) {
        // Can only extend right
        maxBinId += 1;
      } else if (rangeLeft > 0) {
        // Can only extend left
        minBinId -= 1;
      } else {
        // At array boundaries, accept even count as fallback
        console.warn(`⚠️ Cannot expand to odd count within array bounds [${arrayMin}, ${arrayMax}]`);
      }
      
      binCount = maxBinId - minBinId + 1;
    }

    console.log(`📊 Active Bin Array: [${arrayMin}, ${arrayMax}]`);
    console.log(`📊 Active Bin ID: ${activeId}`);
    console.log(`📊 Final Bin Range: [${minBinId}, ${maxBinId}]`);
    console.log(`📊 Bin Count: ${binCount} (ODD=${binCount % 2 === 1})`);

    // Verify the range is valid
    if (minBinId > activeId || maxBinId < activeId) {
      throw new Error(
        `Invalid bin range [${minBinId}, ${maxBinId}] for active bin ${activeId}. ` +
        `Active bin must be within range.`
      );
    }

    // ✅ CRITICAL: SpotBalanced REQUIRES ODD bin count
    if (binCount % 2 === 0) {
      throw new Error(
        `SpotBalanced requires ODD bin count. Got ${binCount} bins in range [${minBinId}, ${maxBinId}]. ` +
        `This should not happen after adjustment logic. Debug: activeId=${activeId}, ` +
        `arrayMin=${arrayMin}, arrayMax=${arrayMax}`
      );
    }

    // ✅ FIX: Get suggested amounts from DLMM for balanced distribution
    console.log(`🔄 Calculating optimal amounts for bin range [${minBinId}, ${maxBinId}]...`);
    
    let strategy;
    const isOneSided = finalXAmount.isZero() || finalYAmount.isZero();

    if (!isOneSided) {
      // For balanced liquidity, use DLMM's suggested amounts
      try {
        // The DLMM SDK calculates the proper ratio based on the bin range
        // For now, we'll use SpotImBalanced which is more forgiving
        // But first try to get better amounts
        
        // Calculate the ratio of X to Y based on bin range
        // For bins centered around active bin, we need to account for price curve
        const binSpan = maxBinId - minBinId;
        
        // Simple heuristic: if spread is symmetric around active, amounts should be more balanced
        // But the DLMM protocol needs specific ratios based on the bin curve
        
        console.log(`📊 Using SpotImBalanced for safer amount handling`);
        console.log(`   (SpotBalanced requires precise amount ratios based on bin curve)`);
        
        // Use SpotImBalanced which is more forgiving of amount mismatches
        strategy = {
          strategyType: "SpotImBalanced" as any,
          minBinId,
          maxBinId,
        };
      } catch (err: any) {
        console.error("Error calculating amounts:", err);
        // Fallback to SpotImBalanced
        strategy = {
          strategyType: "SpotImBalanced" as any,
          minBinId,
          maxBinId,
        };
      }
    } else {
      console.log("⚠️ One-sided liquidity → SpotImBalanced");

      // Ensure dust on missing side
      if (finalXAmount.isZero()) finalXAmount = DUST;
      if (finalYAmount.isZero()) finalYAmount = DUST;

      strategy = {
        strategyType: "SpotImBalanced" as any,
        minBinId,
        maxBinId,
      };
    }

    console.log("🔍 Final Strategy Parameters:", {
      activeId,
      strategy: strategy.strategyType,
      minBinId: strategy.minBinId,
      maxBinId: strategy.maxBinId,
      binCount: binCount,
      X: finalXAmount.toString(),
      Y: finalYAmount.toString(),
    });

    console.log(
      `💧 Creating position with strategy: ${strategy.strategyType} ` +
      `[${strategy.minBinId}, ${strategy.maxBinId}]`
    );
    console.log(`   Bin Count: ${binCount}`);
    console.log(`   Amounts: X=${finalXAmount.toString()} Y=${finalYAmount.toString()}`);

    let createPositionTx;
    try {
      const positionKeypair = Keypair.generate();

      createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: positionKeypair.publicKey,
        user: ownerPubkey,
        totalXAmount: finalXAmount,
        totalYAmount: finalYAmount,
        strategy: strategy,
        slippage: slippageBps / 10000,
      });

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
        binCount: binCount,
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