// app/api/liquidity/create/route.ts
import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
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
  "finalized"
);

const WSOL_MINT_ADDRESS = new PublicKey("So11111111111111111111111111111111111111112");

// Devnet DLMM Program ID
const METEORA_DLMM_PROGRAM_ID = new PublicKey(
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
);

async function waitForAccount(
  pubkey: PublicKey,
  maxRetries: number = 40,
  baseDelayMs: number = 1000
): Promise<boolean> {
  let retries = 0;
  console.log(`⏳ Waiting for account ${pubkey.toBase58()}...`);

  while (retries < maxRetries) {
    try {
      const acc = await solanaConnection.getAccountInfo(pubkey, "confirmed");
      if (acc && acc.data.length > 0) {
        console.log(`✅ Account found after ${retries} attempts`);
        return true;
      }
    } catch (error: any) {
      console.log(`Retry ${retries + 1}/${maxRetries}: ${error.message}`);
    }

    const delayMs =
      retries < 10 ? baseDelayMs : retries < 20 ? baseDelayMs * 2 : baseDelayMs * 3;
    await new Promise((res) => setTimeout(res, delayMs));
    retries++;

    if (retries % 5 === 0) {
      console.log(`⏳ Still waiting... (${retries}/${maxRetries} attempts)`);
    }
  }

  return false;
}

export async function POST(req: Request) {
  try {
    // --- AUTH ---
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorizationHeader.split(" ")[1];
    if (!process.env.JWT_SECRET) {
      console.error("Missing JWT_SECRET");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err: any) {
      console.error("JWT verify failed:", err);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const creatorProfileId = decodedToken.id;

    // --- BODY ---
    const body = await req.json();
    const {
      communityId,
      tokenMintAddress,
      solAmount,
      tokenAmount,
      tokenDecimals,
      binStep = 25,
      initialPrice = 1.0,
      userPublicKey,
    } = body;

    console.log("📋 Create Pool Parameters:", {
      communityId,
      tokenMintAddress,
      solAmount,
      tokenAmount,
      tokenDecimals,
      binStep,
      initialPrice,
      userPublicKey,
    });

    if (
      !communityId ||
      !tokenMintAddress ||
      solAmount == null ||
      tokenAmount == null ||
      tokenDecimals == null ||
      !userPublicKey
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // --- COMMUNITY CHECK ---
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("creator_id, token_mint_address")
      .eq("id", communityId)
      .single();

    if (error || !community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    if (community.creator_id !== creatorProfileId) {
      return NextResponse.json(
        { error: "Only the community creator can create a pool" },
        { status: 403 }
      );
    }

    if (community.token_mint_address !== tokenMintAddress) {
      return NextResponse.json(
        { error: "Token mint mismatch for community" },
        { status: 400 }
      );
    }

    // --- VALIDATE AMOUNTS ---
    if (solAmount <= 0 || tokenAmount <= 0) {
      return NextResponse.json(
        { error: "Amounts must be positive" },
        { status: 400 }
      );
    }

    if (tokenDecimals < 0 || tokenDecimals > 18) {
      return NextResponse.json(
        { error: "Invalid token decimals" },
        { status: 400 }
      );
    }

    // Validate bin step (must be standard)
    const validBinSteps = [1, 10, 25, 100];
    if (!validBinSteps.includes(binStep)) {
      return NextResponse.json(
        {
          error: `Invalid bin step ${binStep}. Must be one of: ${validBinSteps.join(", ")}`,
        },
        { status: 400 }
      );
    }

    console.log("🔄 Building transaction for new Meteora DLMM pool...");

    const tokenXMint = new PublicKey(tokenMintAddress);
    const tokenYMint = WSOL_MINT_ADDRESS;
    const ownerPubkey = new PublicKey(userPublicKey);

    // Get preset parameter PDA
    const baseFactor = new BN(10000);

    const [presetParameter] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("preset_parameter"),
        new BN(binStep).toArrayLike(Buffer, "le", 2),
        baseFactor.toArrayLike(Buffer, "le", 2),
      ],
      METEORA_DLMM_PROGRAM_ID
    );

    // Verify preset parameter exists
    console.log(`🔍 Checking preset parameter: ${presetParameter.toBase58()}`);
    const presetParamAccount = await solanaConnection.getAccountInfo(
      presetParameter
    );
    if (!presetParamAccount) {
      throw new Error(
        `Preset parameter account ${presetParameter.toBase58()} not found for bin step ${binStep}. ` +
          `Please use a standard bin step (e.g., 1, 10, 25, 100).`
      );
    }
    console.log("✅ Preset parameter found");

    // --- SORT MINTS (Token < WSOL if true, else swap) ---
    let mintX: PublicKey;
    let mintY: PublicKey;
    let initialXAmount: BN;
    let initialYAmount: BN;
    let decimalsX: number;
    let decimalsY: number;
    let price = initialPrice;

    const comparison = Buffer.compare(
      tokenXMint.toBuffer(),
      tokenYMint.toBuffer()
    );

    if (comparison < 0) {
      // Token < WSOL, token is X
      mintX = tokenXMint;
      mintY = tokenYMint;
      initialXAmount = new BN(
        (tokenAmount * Math.pow(10, tokenDecimals)).toFixed(0)
      );
      initialYAmount = new BN((solAmount * Math.pow(10, 9)).toFixed(0));
      decimalsX = tokenDecimals;
      decimalsY = 9;
    } else {
      // Token > WSOL, WSOL is X, Token is Y
      mintX = tokenYMint;
      mintY = tokenXMint;
      initialXAmount = new BN((solAmount * Math.pow(10, 9)).toFixed(0));
      initialYAmount = new BN(
        (tokenAmount * Math.pow(10, tokenDecimals)).toFixed(0)
      );
      decimalsX = 9;
      decimalsY = tokenDecimals;
      price = 1.0 / initialPrice;

      console.log("⚠️ Mints reordered: WSOL is tokenX, Token is tokenY");
    }

    console.log(`✅ Sorted mints:`);
    console.log(`   X: ${mintX.toBase58()} (Decimals: ${decimalsX})`);
    console.log(`   Y: ${mintY.toBase58()} (Decimals: ${decimalsY})`);

    // --- CALCULATE ACTIVE BIN FROM PRICE ---
    const decimalAdjustment = Math.pow(10, decimalsY - decimalsX);
    const rawPrice = price * decimalAdjustment;
    const pricePerBin = 1 + binStep / 10000;
    const activeId = new BN(
      Math.floor(Math.log(rawPrice) / Math.log(pricePerBin))
    );

    console.log(`📊 Price Calculation:`);
    console.log(`   Initial UI Price: ${price}`);
    console.log(`   Decimal Adjustment: 10^(${decimalsY} - ${decimalsX}) = ${decimalAdjustment}`);
    console.log(`   Raw Price (for bins): ${rawPrice}`);

    console.log(`💰 Initial Liquidity:`);
    console.log(`   X: ${initialXAmount.toString()} (raw units)`);
    console.log(`   Y: ${initialYAmount.toString()} (raw units)`);

    console.log(`📈 Bin Calculation:`);
    console.log(`   Bin Step: ${binStep} (price increase per bin: ${((pricePerBin - 1) * 100).toFixed(4)}%)`);
    console.log(`   Price Per Bin: ${pricePerBin}`);
    console.log(`   Calculated Active Bin ID: ${activeId.toString()}`);

    // --- CREATE LB PAIR TRANSACTION ---
    console.log("🔨 Creating LB pair transaction...");
    let createTx: Transaction;

    try {
      createTx = await DLMM.createLbPair(
        solanaConnection,
        ownerPubkey,
        mintX,
        mintY,
        new BN(binStep),
        baseFactor,
        presetParameter,
        activeId,
        {
          cluster: "devnet",
        }
      );
      console.log("✅ LB pair transaction created");
    } catch (createError: any) {
      console.error("❌ Error creating LB pair transaction:", createError);
      throw new Error(
        `Failed to create LB pair transaction: ${createError.message}`
      );
    }

    // --- EXTRACT LB PAIR ADDRESS ---
    const createIx = createTx.instructions.find((ix) =>
      ix.programId.equals(METEORA_DLMM_PROGRAM_ID)
    );

    if (!createIx) {
      throw new Error("No Meteora DLMM instruction found in transaction");
    }

    if (!createIx.keys || createIx.keys.length === 0) {
      throw new Error("No keys found in Meteora DLMM instruction");
    }

    // LB Pair is typically the first writable account
    const lbPairKey = createIx.keys.find((key) => key.isSigner === false && key.isWritable);
    if (!lbPairKey) {
      throw new Error("Could not find LB Pair account in instruction keys");
    }

    const lbPairAddress = lbPairKey.pubkey;
    console.log("✅ Extracted LB Pair Address:", lbPairAddress.toBase58());

    // --- PREPARE TRANSACTION ---
    const { blockhash } = await solanaConnection.getLatestBlockhash("finalized");
    createTx.recentBlockhash = blockhash;
    createTx.feePayer = ownerPubkey;

    // Serialize
    const serializedCreateTx = createTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    console.log("✅ Pool creation transaction serialized successfully");
    console.log(`   Transaction size: ${serializedCreateTx.length} bytes`);

    // --- RESPONSE ---
    return NextResponse.json(
      {
        createPoolTransaction: bs58.encode(serializedCreateTx),
        lbPairAddress: lbPairAddress.toBase58(),
        liquidityParams: {
          tokenXAmount: initialXAmount.toString(),
          tokenYAmount: initialYAmount.toString(),
          activeId: activeId.toNumber(),
          tokenDecimals: decimalsY, // Return the token's decimals
          mintX: mintX.toBase58(),
          mintY: mintY.toBase58(),
          binStep,
        },
        message:
          "Pool creation transaction ready. After confirmation, add initial liquidity via /api/liquidity/add",
        instructions: [
          "1. Sign and send createPoolTransaction",
          "2. Wait for confirmation (finalized)",
          "3. Call /api/liquidity/add with lbPairAddress and the liquidityParams",
          "4. Pool will be ready with initial liquidity",
        ],
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ /api/liquidity/create error:", err);
    return NextResponse.json(
      {
        error: err?.message || String(err),
        details: err?.stack,
      },
      { status: 500 }
    );
  }
}