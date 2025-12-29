import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const {name} = await params;
    const names = decodeURIComponent(name);
    console.log(`🔍 API: Fetching community by name. Raw: '${name}', Decoded: '${names}'`);

    // 1. Fetch Community Details (Case-insensitive)
    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("*")
      .ilike("name", names)
      .single();

    if (error || !community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Member Count
    const { count: memberCount } = await supabaseAdmin
      .from("community_members")
      .select("*", { count: "exact", head: true })
      .eq("community_id", community.id);

    // 3. Check if current user is member (Optimistic check via Auth header)
    let isJoined = false;
    const authorizationHeader = req.headers.get("Authorization");
    if (authorizationHeader && authorizationHeader.startsWith("Bearer ") && process.env.JWT_SECRET) {
        try {
            const token = authorizationHeader.split(" ")[1];
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            const { data: membership } = await supabaseAdmin
                .from("community_members")
                .select("id")
                .eq("community_id", community.id)
                .eq("profile_id", userId)
                .single();
            
            if (membership) isJoined = true;
        } catch (e) {
            // Ignore auth errors, just return public data
        }
    }

    return NextResponse.json({
      community: {
        ...community,
        members: memberCount || 0,
        isJoined
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/communities/[name] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
