import { getCache, setCache } from "@/utils/redis";
import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
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

    // 1. Fetch community details to get lbPair address
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("meteora_lb_pair_address, token_mint_address")
      .eq("id", communityId)
      .single();

    if (error || !community || !community.meteora_lb_pair_address) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const lbPairAddr = community.meteora_lb_pair_address;
    const cacheKey = `price_history_${communityId}`;

    // 2. Fetch current price from DLMM
    const dlmmPool = await DLMM.create(connection, new PublicKey(lbPairAddr), {
        cluster: connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"
    });

    const activeBin = await dlmmPool.getActiveBin();
    const currentPrice = parseFloat(activeBin.price);

    // 3. Update History in Redis
    let history = await getCache(cacheKey) || [];
    const now = Date.now();
    
    // Only add if price changed or enough time passed (cooldown of 10s)
    const lastPoint = history[history.length - 1];
    if (!lastPoint || (Math.abs(lastPoint.price - currentPrice) > 0.00000001) || (now - lastPoint.time > 60000)) {
        history.push({ price: currentPrice, time: now });
        if (history.length > 100) history = history.slice(-100);
        await setCache(cacheKey, history, 604800); // 7 days TTL
    }

    return NextResponse.json({
      price: currentPrice,
      history: history
    });

  } catch (error: any) {
    console.error("Price API error:", error);
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
  }
}
