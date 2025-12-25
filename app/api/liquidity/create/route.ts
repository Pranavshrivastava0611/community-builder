// app/api/liquidity/create/route.ts
import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import BN from "bn.js";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

// ------------------------
// Supabase admin client
// ------------------------
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

// ------------------------
// Solana connection
// ------------------------
const solanaConnection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || "https://api.devnet.solana.com",
  "finalized"
);

const WSOL_MINT_ADDRESS = new PublicKey("So11111111111111111111111111111111111111112");

// Devnet DLMM Program ID
const METEORA_DLMM_PROGRAM_ID = new PublicKey( "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");

// ------------------------
// API Route
// ------------------------
export async function POST(req: Request) {
  try {
    // --- AUTH (Bearer JWT) ---
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorizationHeader.split(" ")[1];
    if (!process.env.JWT_SECRET) {
      console.error("Missing JWT_SECRET");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
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
      binStep = 100,
      initialPrice = 1.0,
      userPublicKey, // frontend-admin wallet pubkey (string)
    } = body;

    if (
      !communityId ||
      !tokenMintAddress ||
      solAmount == null ||
      tokenAmount == null ||
      tokenDecimals == null ||
      !userPublicKey
    ) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // --- COMMUNITY CHECK ---
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("creator_id, token_mint_address")
      .eq("id", communityId)
      .single();

    if (error || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (community.creator_id !== creatorProfileId) {
      return NextResponse.json({ error: "Only the community creator can create a pool" }, { status: 403 });
    }

    if (community.token_mint_address !== tokenMintAddress) {
      return NextResponse.json({ error: "Token mint mismatch for community" }, { status: 400 });
    }

    // ------------------------
    // Create new LB pair WITH initial liquidity
    // ------------------------
    console.log("Building transaction for new Meteora DLMM pool WITH initial liquidity...");

    const tokenXMint = new PublicKey(tokenMintAddress);
    const tokenYMint = WSOL_MINT_ADDRESS;
    const ownerPubkey = new PublicKey(userPublicKey);

    // Get preset parameter PDA
    const baseFactor = new BN(10000); // Standard base factor
    
    const [presetParameter] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("preset_parameter"),
        new BN(binStep).toArrayLike(Buffer, "le", 2),
        baseFactor.toArrayLike(Buffer, "le", 2),
      ],
      METEORA_DLMM_PROGRAM_ID
    );

    // Verify preset parameter exists
    const presetParamAccount = await solanaConnection.getAccountInfo(presetParameter);
    if (!presetParamAccount) {
        throw new Error(`Preset parameter account ${presetParameter.toBase58()} not found for bin step ${binStep}. Please try a standard bin step (e.g. 100).`);
    }

    // CRITICAL: Sort mints (DLMM requires TokenX < TokenY)
    let mintX = tokenXMint;
    let mintY = tokenYMint;
    let price = initialPrice;
    let initialXAmount = new BN(tokenAmount * Math.pow(10, tokenDecimals));
    let initialYAmount = new BN(solAmount * Math.pow(10, 9)); // SOL has 9 decimals

    let decimalsX = tokenDecimals;
    let decimalsY = 9; // SOL has 9 decimals

    if (Buffer.compare(tokenXMint.toBuffer(), tokenYMint.toBuffer()) > 0) {
        mintX = tokenYMint; // SOL becomes X
        mintY = tokenXMint; // Token becomes Y
        price = 1.0 / initialPrice;
        
        // Swap amounts
        const temp = initialXAmount;
        initialXAmount = initialYAmount;
        initialYAmount = temp;

        // Swap decimals tracking
        decimalsX = 9;
        decimalsY = tokenDecimals;
    }

    console.log(`Sorted mints: X=${mintX.toBase58()} (Dec: ${decimalsX}), Y=${mintY.toBase58()} (Dec: ${decimalsY})`);
    
    // Adjust price to represent Raw Ratio (RawY / RawX)
    // Current price is UI Ratio (UI_Y / UI_X)
    // Raw Ratio = UI Ratio * (10^DecY / 10^DecX)
    price = price * Math.pow(10, decimalsY - decimalsX);
    
    console.log(`Initial liquidity: X=${initialXAmount.toString()}, Y=${initialYAmount.toString()}`);
    console.log(`Initial Raw Price: ${price} (adjusted for decimals)`);

    const pricePerBin = 1 + binStep / 10000;
    const activeId = new BN(Math.floor(Math.log(price) / Math.log(pricePerBin)));

    console.log(`Calculated activeId: ${activeId.toString()}`);

    // Step 1: Create the LB pair
    const createTx = await DLMM.createLbPair(
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

    // Extract LB Pair Address from transaction
    const createIx = createTx.instructions.find(ix => 
      ix.programId.equals(METEORA_DLMM_PROGRAM_ID)
    );

    if (!createIx) {
      throw new Error("No Meteora DLMM instruction found in the generated transaction.");
    }
    if (!createIx.keys[0].isWritable) {
      throw new Error("LB Pair account not writable — instruction layout changed");
    }

    const lbPairAddress = createIx.keys[0].pubkey;
    console.log("✅ Extracted LB Pair Address:", lbPairAddress.toBase58());

    // Prepare transaction for sending
    const { blockhash } = await solanaConnection.getLatestBlockhash("finalized");
    createTx.recentBlockhash = blockhash;
    createTx.feePayer = ownerPubkey;

    // Serialize the pool creation transaction
    const serializedCreateTx = createTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Return pool creation transaction and parameters for liquidity addition
    // The frontend will:
    // 1. Send and confirm the pool creation transaction
    // 2. Call /api/liquidity/add with these parameters to add initial liquidity
    return NextResponse.json(
      {
        createPoolTransaction: bs58.encode(serializedCreateTx),
        lbPairAddress: lbPairAddress.toBase58(),
        liquidityParams: {
          tokenXAmount: initialXAmount.toString(),
          tokenYAmount: initialYAmount.toString(),
          activeId: activeId.toNumber(),
          tokenDecimals,
          mintX: mintX.toBase58(),
          mintY: mintY.toBase58(),
        },
        message: "Pool creation transaction ready. After confirmation, add initial liquidity via /api/liquidity/add",
        instructions: [
          "1. Sign and send createPoolTransaction",
          "2. Wait for confirmation (finalized)",
          "3. Call /api/liquidity/add with lbPairAddress and liquidityParams",
          "4. Pool will be ready with initial liquidity"
        ]
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("/api/liquidity/create error:", err);
    return NextResponse.json(
      { 
        error: err?.message || String(err),
        details: err?.stack 
      }, 
      { status: 500 }
    );
  }
}