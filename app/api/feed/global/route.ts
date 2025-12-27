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

    // Fetch Global Posts (Pool for trending)
    // We fetch a larger pool (e.g. 100) ordered by Recency OR a mix. 
    // Since we need time decay, very old posts have low score anyway.
    // We'll fetch last 100, calculate score, sort, then return requested page.
    // IMPORTANT: Ideally use RPC for server-side sorting. For MVP, JS Sort.
    
    // Pagination params for the *result* page
    const pageSize = 20;

    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select(`
        *,
        author:profiles(username, avatar_url),
        community:communities(name, image_url),
        comments(count)
      `)
      .order("created_at", { ascending: false })
      .limit(100); // Pool size

    if (error) {
        console.error("Global feed error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate Scores & Map Data
    const scoredPosts = posts.map(p => {
        const hoursAge = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
        
        // Handle counts from relations or columns
        // comments relation returns [{ count: N }]
        const commentCount = p.comments?.[0]?.count || 0;
        const likeCount = p.like_count || 0; // Assuming like_count col or fetch similarly if table exists

        const score = (likeCount * 2) + (commentCount * 3) - (hoursAge * 0.1);
        
        return { 
            ...p, 
            user: p.author, 
            user_id: p.author_id,
            trendScore: score,
            like_count: likeCount,
            comment_count: commentCount
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

    // Enrich with Likes
    let enrichedPosts = pagedPosts;
    if (currentUserId && pagedPosts.length > 0) {
        const postIds = pagedPosts.map(p => p.id);
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
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
