import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
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
    const { userPublicKey, positionPubKey, bps, shouldClaimAndClose = false } = body;

    if (decoded.public_key !== userPublicKey) {
         return NextResponse.json({ error: "Wallet mismatch" }, { status: 403 });
    }

    if (!positionPubKey || !bps) {
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

    // 2. Initialize DLMM
    const dlmmPool = await DLMM.create(connection, new PublicKey(community.meteora_lb_pair_address), {
        cluster: connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"
    });

    // 3. Get Position info to determine bin range
    // We need fromBinId and toBinId.
    // 'removeLiquidity' requires these.
    // We can fetch the position first.
    // dlmmPool.getPositionsByUserAndLbPair -> find match?
    // OR dlmmPool.getPosition? Note: Docs didn't explicitly list getPosition in previous snippet but used it in example: const position = await dlmmPool.getPosition(positionPublicKey);
    // Let's assume it exists. (Wait, previous error said `getPositionsByUser` was missing, forcing use of `getPositionsByUserAndLbPair`. `getPosition` might be fine? check example in user request: `const position = await dlmmPool.getPosition(positionPublicKey);`
    
    // However, `getPositionsByUserAndLbPair` returns list.
    // Let's try `lbPair.getPosition` if SDK exposes it. 
    // Wait, the SDK example for `removeLiquidity` uses:
    // const position = await dlmmPool.getPositionsByUserAndLbPair(userPublicKey);
    // Oh wait, example for removeLiquidity doesn't show getting position object, it shows:
    // params: user, position (pubkey), fromBinId, toBinId.
    // We need to know the bin range of the position.
    
    // Let's use `getPositionsByUserAndLbPair` to find our specific position and get its bin range.
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(new PublicKey(userPublicKey));
    const targetPos = userPositions.find((p: any) => p.publicKey.toBase58() === positionPubKey);
    
    if (!targetPos) {
         return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    // `userPositions` items usually contain `positionData` which has `lowerBinId` / `upperBinId`.
    const fromBinId = targetPos.positionData.lowerBinId;
    const toBinId = targetPos.positionData.upperBinId;

    // 4. Remove Liquidity
    // `removeLiquidity` returns Transaction | Transaction[]
    const result = await dlmmPool.removeLiquidity({
        user: new PublicKey(userPublicKey),
        position: new PublicKey(positionPubKey),
        fromBinId,
        toBinId,
        bps: new BN(bps), // basis points (50% = 5000)
        shouldClaimAndClose
    });
    
    const txs = Array.isArray(result) ? result : [result];
    const { blockhash } = await connection.getLatestBlockhash("finalized");

    const serializedTxs = txs.map(tx => {
        tx.recentBlockhash = blockhash;
        tx.feePayer = new PublicKey(userPublicKey);
        return bs58.encode(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
    });

    return NextResponse.json({
        transactions: serializedTxs
    });

  } catch (error: any) {
    console.error("Remove Liquidity API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
