import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(req: Request) {
  try {
    // Check for search query params (optional)
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    // Fetch communities
    // TODO: Join with members count if possible efficiently
    const { data: communities, error } = await supabaseAdmin
      .from("communities")
      .select(`
        *,
        members:community_members(count)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching communities:", error);
      return NextResponse.json(
        { error: "Failed to fetch communities" },
        { status: 500 }
      );
    }

    const formattedCommunities = communities?.map(c => ({
      ...c,
      members: (c.members as any)?.[0]?.count || 0
    }));

    return NextResponse.json({ communities: formattedCommunities }, { status: 200 });
  } catch (error: any) {
    console.error("API /api/communities error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
