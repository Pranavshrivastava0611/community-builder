// app/api/liquidity/create/route.ts
import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
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
    // Create new LB pair transaction
    // ------------------------
    console.log("Building unsigned transaction for new Meteora DLMM pool...");

    const tokenXMint = new PublicKey(tokenMintAddress);
    const tokenYMint = WSOL_MINT_ADDRESS;
    const ownerPubkey = new PublicKey(userPublicKey);

    // First, we need to get or create a preset parameter account
    // Preset parameters define the fee structure and other pool settings
    // For devnet, you can use a default preset or create one
    
    // Get preset parameter PDA (this is typically derived from bin step and base factor)
    // baseFactor is used for price calculation: price = (1 + baseFactor/10000)^binId
    const baseFactor = new BN(10000); // Standard base factor
    
    // Derive preset parameter address
    // You may need to create this first or use an existing one
    // For now, we'll try to find or create a standard preset
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

    // Calculate active bin ID from initial price
    // activeId determines the starting price bin
    // Formula: activeId = log(price) / log(1 + binStep/10000)
    
    // CRITICAL: Sort mints.
    // DLMM requires TokenX < TokenY.
    // Use Buffer comparison for deterministic sorting.
    let mintX = tokenXMint;
    let mintY = tokenYMint;
    let price = initialPrice;

    if (Buffer.compare(tokenXMint.toBuffer(), tokenYMint.toBuffer()) > 0) {
        mintX = tokenYMint; // SOL becomes X
        mintY = tokenXMint; // Token becomes Y
        // If X=SOL and Y=Token, price (Y/X) is Token/SOL.
        // User inputs Price = SOL/Token.
        // So we must invert.
        price = 1.0 / initialPrice;
    }

    const pricePerBin = 1 + binStep / 10000;
    const activeId = new BN(Math.floor(Math.log(price) / Math.log(pricePerBin)));

    // Create the LB pair using the correct signature and SORTED mints
    const createTx = await DLMM.createLbPair(
      solanaConnection,
      ownerPubkey, // funder
      mintX, // tokenX (sorted)
      mintY, // tokenY (sorted)
      new BN(binStep), // binStep
      baseFactor, // baseFactor
      presetParameter, // presetParameter PDA
      activeId, // activeId (starting bin)
      {
        cluster: "devnet",
      }
    );

    // Extract transaction and LB pair address
    // createLbPair returns just a Transaction
    const tx = createTx;

    if (!tx) {
      console.error("Unexpected createLbPair response");
      throw new Error("Failed to create LB pair transaction");
    }

    // Extract valid LB Pair Address directly from the transaction instructions
    // This avoids manual PDA derivation errors and ensures we track the true account
    const createIx = tx.instructions.find(ix => 
      ix.programId.equals(METEORA_DLMM_PROGRAM_ID)
    );

    if (!createIx) {
      throw new Error("No Meteora DLMM instruction found in the generated transaction.");
    }
    if (!createIx.keys[0].isWritable) {
  throw new Error("LB Pair account not writable — instruction layout changed");
}

    // The LB Pair account is the first account in the InitializeLbPair instruction
    const lbPairAddress = createIx.keys[0].pubkey;
    console.log("✅ Extracted LB Pair Address from transaction:", lbPairAddress.toBase58());

    // Add recent blockhash and fee payer
    const { blockhash } = await solanaConnection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = ownerPubkey;

    // Serialize unsigned transaction
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // NOTE: We do NOT save the address to DB here anymore.
    // The client must sign, send, confirm, VERIFY the account exists, and then call /api/community/update-pool


    // Removed the internal call to /api/liquidity/add as the transaction hasn't been signed/sent yet.
    // The client orchestrates: Create Pool -> Sign -> Send -> Wait -> Add Liquidity -> Sign -> Send.

    return NextResponse.json(
      {
        serializedTransaction: bs58.encode(serialized),
        lbPairAddress: lbPairAddress.toBase58(),
        message: "Unsigned pool creation transaction ready. Sign & send on frontend.",
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