import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: Request) {
  try {
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && process.env.JWT_SECRET) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch {}
    }

    if (!userId) {
      // If not logged in, just return top 10 communities
      const { data: trending } = await supabaseAdmin
        .from("communities")
        .select("id, name, image_url")
        .limit(10);
      return NextResponse.json({ communities: trending || [] });
    }

    // 1. Get communities the user is ALREADY in
    const { data: memberships } = await supabaseAdmin
      .from("community_members")
      .select("community_id")
      .eq("profile_id", userId);
    
    const joinedIds = memberships?.map(m => m.community_id) || [];

    // 2. Fetch communities the user is NOT in
    // For "matching interests", we'll pick communities that have high engagement but user hasn't joined
    let query = supabaseAdmin
      .from("communities")
      .select("id, name, image_url");
    
    if (joinedIds.length > 0) {
      query = query.not("id", "in", `(${joinedIds.join(",")})`);
    }

    const { data: suggestions, error } = await query.limit(10);

    if (error) throw error;

    return NextResponse.json({ communities: suggestions || [] });

  } catch (error: any) {
    console.error("Suggestions API Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
