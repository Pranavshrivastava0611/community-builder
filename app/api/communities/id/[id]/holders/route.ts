import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || "https://api.devnet.solana.com");

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch community metadata
    const { data: community, error: fetchError } = await supabaseAdmin
      .from("communities")
      .select("token_mint_address")
      .eq("id", id)
      .single();

    if (fetchError || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (!community.token_mint_address) {
      return NextResponse.json({ holders: [] });
    }

    // 2. Fetch largest token accounts from Solana
    try {
      const mint = new PublicKey(community.token_mint_address);
      const largestAccounts = await connection.getTokenLargestAccounts(mint);
      
      const topHoldersRaw = await Promise.all(
        (largestAccounts.value || []).slice(0, 20).map(async (acc) => {
          const info = await connection.getParsedAccountInfo(acc.address);
          const owner = (info.value?.data as any)?.parsed?.info?.owner;
          return {
            address: owner,
            amount: acc.uiAmount
          };
        })
      );

      // 3. Resolve addresses to platform profiles & roles
      const addresses = topHoldersRaw.map(h => h.address).filter(Boolean);
      
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, avatar_url, public_key")
        .in("public_key", addresses);

      // Fetch member roles for these profiles in this community
      const profileIds = profiles?.map(p => p.id) || [];
      const { data: members } = await supabaseAdmin
        .from("community_members")
        .select("profile_id, role")
        .eq("community_id", id)
        .in("profile_id", profileIds);

      const memberRoleMap: Record<string, string> = {};
      members?.forEach(m => {
        memberRoleMap[m.profile_id] = m.role;
      });

      const profileMap: Record<string, any> = {};
      profiles?.forEach(p => {
        profileMap[p.public_key] = {
            ...p,
            communityRole: memberRoleMap[p.id]
        };
      });

      const holders = topHoldersRaw
        .filter(h => h.address)
        .map(h => ({
          ...h,
          user: profileMap[h.address] || { username: h.address.substring(0, 4) + '...' + h.address.substring(h.address.length - 4) }
        }));

      return NextResponse.json({ holders: holders.slice(0, 5) }); // Top 5
    } catch (e: any) {
      console.error("Solana fetch error:", e);
      return NextResponse.json({ holders: [], error: "Failed to fetch on-chain data" });
    }

  } catch (error: any) {
    console.error("API /api/communities/id/[id]/holders error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
