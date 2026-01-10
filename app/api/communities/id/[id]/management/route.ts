import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
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

export async function GET(
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

    // 2. Verify if user is creator
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("creator_id, meteora_lb_pair_address")
      .eq("id", communityId)
      .single();

    if (error || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (community.creator_id !== userId) {
      return NextResponse.json({ error: "Only creator can manage" }, { status: 403 });
    }

    if (!community.meteora_lb_pair_address) {
      return NextResponse.json({ error: "No pool linked" }, { status: 400 });
    }

    // 3. Fetch Positions and Fees from DLMM
    const dlmmPool = await DLMM.create(connection, new PublicKey(community.meteora_lb_pair_address), {
        cluster: connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"
    });

    // Use 'getPositionsByUserAndLbPair' as per official docs
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(new PublicKey(userPk));
    
    // Aggregate fees
    let totalXFees = 0;
    let totalYFees = 0;
    
    // Correct way to access decimals in this SDK version
    // Safe access for decimals with fallback
    const decimalsX = (dlmmPool.tokenX as any).decimal || (dlmmPool.tokenX as any).decimals || 9;
    const decimalsY = (dlmmPool.tokenY as any).decimal || (dlmmPool.tokenY as any).decimals || 9;
    
    console.log(`DLMM Token Decimals found: X=${decimalsX}, Y=${decimalsY}`);
    
    const positions = userPositions.map((pos: any) => {
        const feesX = Number(pos.positionData.feeX.toString());
        const feesY = Number(pos.positionData.feeY.toString());
        totalXFees += feesX;
        totalYFees += feesY;
        
        return {
            publicKey: pos.publicKey.toBase58(),
            feesX: feesX / Math.pow(10, decimalsX),
            feesY: feesY / Math.pow(10, decimalsY),
        };
    });

    return NextResponse.json({
      positions,
      totalFees: {
          x: totalXFees / Math.pow(10, decimalsX),
          y: totalYFees / Math.pow(10, decimalsY),
          xSymbol: dlmmPool.tokenX.publicKey.toBase58() === "So11111111111111111111111111111111111111112" ? "SOL" : "TOKEN",
          ySymbol: dlmmPool.tokenY.publicKey.toBase58() === "So11111111111111111111111111111111111111112" ? "SOL" : "TOKEN",
      }
    });

  } catch (error: any) {
    console.error("Management API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
