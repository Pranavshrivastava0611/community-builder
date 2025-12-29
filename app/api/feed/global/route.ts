import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { 
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    global: { headers: { 'x-connection-pool': 'true' } }
  }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
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

    // OPTIMIZED: Single query with all joins - reduces round trips from N+1 to 1
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
        author:profiles!posts_author_id_fkey(username, avatar_url),
        community:communities!posts_community_id_fkey(name, image_url),
        media(file_url)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
        console.error("Global feed error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
        return NextResponse.json({ posts: [] }, { status: 200 });
    }

    // Calculate Scores & Map Data (in-memory, fast)
    const scoredPosts = posts.map(p => {
        const hoursAge = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
        const likeCount = p.like_count || 0;
        const commentCount = p.comment_count || 0;
        const score = (likeCount * 2) + (commentCount * 3) - (hoursAge * 0.1);
        
        return { 
            ...p, 
            user: p.author, 
            user_id: p.author_id,
            trendScore: score,
            like_count: likeCount,
            comment_count: commentCount,
            image_url: p.media?.[0]?.file_url || null
        };
    });

    // Sort by Score DESC, then created_at DESC
    scoredPosts.sort((a, b) => {
        if (b.trendScore === a.trendScore) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return b.trendScore - a.trendScore;
    });

    // Paginate in memory
    const pagedPosts = scoredPosts.slice(from, to + 1);

    // OPTIMIZED: Batch fetch likes in ONE query instead of N queries
    let enrichedPosts = pagedPosts;
    if (currentUserId && pagedPosts.length > 0) {
        const postIds = pagedPosts.map(p => p.id);
        
        // Single batched query for all likes
        const { data: likes } = await supabaseAdmin
            .from("post_likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", postIds);
        
        const likedPostIds = new Set(likes?.map(l => l.post_id) || []);
        enrichedPosts = pagedPosts.map(p => ({
            ...p,
            isLiked: likedPostIds.has(p.id)
        }));
    } else {
        enrichedPosts = pagedPosts.map(p => ({ ...p, isLiked: false }));
    }

    return NextResponse.json({ posts: enrichedPosts }, { status: 200 });

  } catch (error: any) {
    console.error("Global feed API error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
