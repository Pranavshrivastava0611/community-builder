import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";
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

    // 1. Auth check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;
    const userPk = decoded.public_key;

    // 2. Verify creator
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("creator_id, meteora_lb_pair_address")
      .eq("id", communityId)
      .single();

    if (error || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (community.creator_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Create Claim All Fees Transaction
    const dlmmPool = await DLMM.create(connection, new PublicKey(community.meteora_lb_pair_address!), {
        cluster: connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"
    });

    // Use getPositionsByUserAndLbPair
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(new PublicKey(userPk));
    
    if (userPositions.length === 0) {
        return NextResponse.json({ error: "No positions found" }, { status: 404 });
    }

    // Use claimAllSwapFee (returns Transaction[])
    const txs = await dlmmPool.claimAllSwapFee({
        owner: new PublicKey(userPk),
        positions: userPositions
    });
    
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    
    // Serialize all transactions
    const serializedTxs = txs.map(tx => {
        tx.recentBlockhash = blockhash;
        tx.feePayer = new PublicKey(userPk);
        return bs58.encode(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
    });

    return NextResponse.json({
        transactions: serializedTxs // Return array of transactions
    });

  } catch (error: any) {
    console.error("Claim Fees API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
