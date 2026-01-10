import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { getAccount, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";
//@ts-ignore
import BN from "bn.js";
import jwt from "jsonwebtoken";
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
    
    // Auth Check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    
    const body = await request.json();
    const { userPublicKey, positionPubKey, amountX, amountY, slippage = 1.0 } = body;

    if (decoded.public_key !== userPublicKey) {
         return NextResponse.json({ error: "Wallet mismatch" }, { status: 403 });
    }

    if (!positionPubKey || !amountX || !amountY) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Fetch Pool
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("meteora_lb_pair_address")
      .eq("id", communityId)
      .single();

    if (error || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }
    const dlmmPool = await DLMM.create(connection, new PublicKey(community.meteora_lb_pair_address), {
        cluster: connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"
    });

    // 3. Resolve Amounts (UI vs Raw)
    // If frontend sends uiAmountX/uiAmountY, we convert using pool decimals (Source of Truth)
    let finalAmountX = amountX ? new BN(amountX) : new BN(0);
    let finalAmountY = amountY ? new BN(amountY) : new BN(0);

    if (body.uiAmountX !== undefined) {
        const tokenXMint = dlmmPool.tokenX.publicKey;
        // Fetch mint info to get correct decimals
        const mintX = await getMint(connection, tokenXMint);
        const decimalsX = mintX.decimals;
        // Handle float precision safely: (val * 10^decimals)
        // Simple approach:
        finalAmountX = new BN(Math.floor(Number(body.uiAmountX) * Math.pow(10, decimalsX)));
    }
    if (body.uiAmountY !== undefined) {
        const tokenYMint = dlmmPool.tokenY.publicKey;
        const mintY = await getMint(connection, tokenYMint);
        const decimalsY = mintY.decimals;
        finalAmountY = new BN(Math.floor(Number(body.uiAmountY) * Math.pow(10, decimalsY)));
    }

    if (finalAmountX.isZero() && finalAmountY.isZero()) {
         return NextResponse.json({ error: "Amounts cannot be zero" }, { status: 400 });
    }

    // --- NEW: Balance Checks ---
    const owner = new PublicKey(userPublicKey);
    const tokenXMint = dlmmPool.tokenX.publicKey;
    const tokenYMint = dlmmPool.tokenY.publicKey;
    
    // Check X Balance
    if (tokenXMint.toBase58() === "So11111111111111111111111111111111111111112") {
        const balance = await connection.getBalance(owner);
        if (new BN(balance).lt(finalAmountX)) {
             return NextResponse.json({ error: `Insufficient SOL balance. Have: ${balance}, Need: ${finalAmountX.toString()}` }, { status: 400 });
        }
    } else {
        try {
            const ataX = await getAssociatedTokenAddress(tokenXMint, owner);
            const accX = await getAccount(connection, ataX);
            if (new BN(accX.amount.toString()).lt(finalAmountX)) {
                 return NextResponse.json({ error: `Insufficient Token X balance. Have: ${accX.amount}, Need: ${finalAmountX.toString()}` }, { status: 400 });
            }
        } catch (e) {
             return NextResponse.json({ error: `Token X account not found` }, { status: 400 });
        }
    }

    // Check Y Balance
    if (tokenYMint.toBase58() === "So11111111111111111111111111111111111111112") {
        const balance = await connection.getBalance(owner);
        if (new BN(balance).lt(finalAmountY)) {
             return NextResponse.json({ error: `Insufficient SOL balance for Y` }, { status: 400 });
        }
    } else {
        try {
             const ataY = await getAssociatedTokenAddress(tokenYMint, owner);
             const accY = await getAccount(connection, ataY);
             if (new BN(accY.amount.toString()).lt(finalAmountY)) {
                  // Explicit error for debugging
                  return NextResponse.json({ error: `Insufficient Token Y balance. Have: ${accY.amount}, Need: ${finalAmountY.toString()}` }, { status: 400 });
             }
        } catch (e) {
             return NextResponse.json({ error: `Token Y account not found` }, { status: 400 });
        }
    }
    // ---------------------------

    // 3. Add Liquidity
    // We must match the existing position's bin range.
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(new PublicKey(userPublicKey));
    const targetPos = userPositions.find((p: any) => p.publicKey.toBase58() === positionPubKey);

    if (!targetPos) {
         return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    const currentStrategy = {
        maxBinId: targetPos.positionData.upperBinId,
        minBinId: targetPos.positionData.lowerBinId,
        strategyType: StrategyType.Spot
    };
    
    // We ignore the passed 'strategy' body param for now ensuring we stick to the position's range
    // If exact range isn't followed, AddLiquidityByStrategy fails for existing positions.
    const finalStrategy = currentStrategy;

    const tx = await dlmmPool.addLiquidityByStrategy({
        positionPubKey: new PublicKey(positionPubKey),
        totalXAmount: finalAmountX,
        totalYAmount: finalAmountY,
        strategy: finalStrategy,
        user: new PublicKey(userPublicKey),
        slippage // %
    });

    // 4. Serialize
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(userPublicKey);

    return NextResponse.json({
        transaction: bs58.encode(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))
    });

  } catch (error: any) {
    console.error("Add Liquidity API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
