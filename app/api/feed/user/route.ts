import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { 
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    
    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const limit = 20;
    const page = parseInt(searchParams.get("page") || "0");
    const from = page * limit;
    const to = from + limit - 1;

    let currentUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && process.env.JWT_SECRET) {
        try {
            const token = authHeader.split(" ")[1];
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
            currentUserId = decoded.id;
        } catch {}
    }

    // Fetch Posts by specific user across all communities
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select(`
        id,
        content,
        created_at,
        like_count,
        comment_count,
        author_id,
        community_id,
        author:profiles(username, avatar_url),
        community:communities(name, image_url),
        media(file_url)
      `)
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
        console.error("User posts API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
        return NextResponse.json({ posts: [] }, { status: 200 });
    }

    // Enrich with isLiked
    let enrichedPosts = posts.map(p => ({
        ...p,
        user: p.author,
        image_url: p.media?.[0]?.file_url || null,
        isLiked: false
    }));

    if (currentUserId) {
        const postIds = posts.map(p => p.id);
        const { data: likes } = await supabaseAdmin
            .from("post_likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", postIds);
        
        const likedPostIds = new Set(likes?.map(l => l.post_id) || []);
        enrichedPosts = enrichedPosts.map(p => ({
            ...p,
            isLiked: likedPostIds.has(p.id)
        }));
    }

    return NextResponse.json({ posts: enrichedPosts }, { status: 200 });

  } catch (error: any) {
    console.error("User posts API error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
