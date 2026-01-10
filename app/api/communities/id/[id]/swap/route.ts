import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";
//@ts-ignore
import BN from "bn.js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || clusterApiUrl("devnet"),
  "confirmed"
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await context.params;
    const body = await request.json();
    const { userPublicKey, inToken, inAmount, slippage = 1.0 } = body;

    if (!userPublicKey || !inToken || !inAmount) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Fetch Pool Address
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("meteora_lb_pair_address")
      .eq("id", communityId)
      .single();

    if (error || !community || !community.meteora_lb_pair_address) {
      return NextResponse.json({ error: "Community pool not found" }, { status: 404 });
    }

    // 2. Initialize DLMM
    const dlmmPool = await DLMM.create(connection, new PublicKey(community.meteora_lb_pair_address), {
        cluster: connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"
    });

    // 3. Determine direction
    // If inToken == tokenX, then we are swapping X for Y (swapForY = true)
    const isSwapForY = inToken === dlmmPool.tokenX.publicKey.toBase58();
    
    // 4. Prepare parameters
    const amountBN = new BN(inAmount);
    const slippageBN = new BN(slippage * 100); // bps

    // 5. Get Bin Arrays (required for quote)
    // The SDK 'getBinArrayForSwap' might take boolean for swapForY
    const binArrays = await dlmmPool.getBinArrayForSwap(isSwapForY);

    // 6. Get Quote
    const quote = await dlmmPool.swapQuote(
        amountBN,
        isSwapForY,
        slippageBN,
        binArrays
    );

    // 7. Build Transaction
    const swapTx = await dlmmPool.swap({
        inToken: new PublicKey(inToken),
        outToken: isSwapForY ? dlmmPool.tokenY.publicKey : dlmmPool.tokenX.publicKey,
        inAmount: amountBN,
        minOutAmount: quote.minOutAmount,
        lbPair: dlmmPool.pubkey,
        user: new PublicKey(userPublicKey),
        binArraysPubkey: quote.binArraysPubkey
    });

    // 8. Serialize
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    swapTx.recentBlockhash = blockhash;
    swapTx.feePayer = new PublicKey(userPublicKey);

    return NextResponse.json({
        transaction: bs58.encode(swapTx.serialize({ requireAllSignatures: false, verifySignatures: false })),
        quote: {
            inAmount: quote.consumedInAmount.toString(),
            outAmount: quote.outAmount.toString(),
            minOutAmount: quote.minOutAmount.toString(),
            priceImpact: quote.priceImpact.toString(),
            fee: quote.fee.toString()
        }
    });

  } catch (error: any) {
    console.error("Swap API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
