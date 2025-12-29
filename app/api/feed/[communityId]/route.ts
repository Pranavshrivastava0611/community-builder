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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ communityId: string }> }
) {
  try {
    const { communityId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = 20;
    const page = parseInt(searchParams.get("page") || "0");
    const from = page * limit;
    const to = from + limit - 1;

    // 1. Get User ID (Optional) for "isLiked" check
    let currentUserId: string | null = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && process.env.JWT_SECRET) {
        try {
            const token = authHeader.split(" ")[1];
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
            currentUserId = decoded.id;
        } catch {}
    }

    // 2. Fetch Posts
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select(`
        *,
        author:profiles(
            id, 
            username, 
            avatar_url,
            roles:community_members(role)
        ),
        comments(count),
        media(file_url)
      `)
      .eq("community_id", communityId)
      .eq("author.roles.community_id", communityId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
        console.error("Feed fetch error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Map relations and Enrich with "isLiked" if logged in
    const mappedPosts = posts.map(p => ({
        ...p,
        user: p.author,
        comment_count: p.comments?.[0]?.count || 0,
        like_count: p.like_count || 0,
        image_url: p.media?.[0]?.file_url || null
    }));

    let enrichedPosts = mappedPosts;
    if (currentUserId && mappedPosts.length > 0) {
        const postIds = mappedPosts.map(p => p.id);
        // Try-catch block for post_likes in case it doesn't exist yet
        try {
            const { data: likes } = await supabaseAdmin
                .from("post_likes")
                .select("post_id")
                .eq("user_id", currentUserId)
                .in("post_id", postIds);
            
            const likedPostIds = new Set(likes?.map(l => l.post_id) || []);
            enrichedPosts = mappedPosts.map(p => ({
                ...p,
                isLiked: likedPostIds.has(p.id)
            }));
        } catch (e) {
            enrichedPosts = mappedPosts.map(p => ({ ...p, isLiked: false }));
        }
    } else {
        enrichedPosts = mappedPosts.map(p => ({ ...p, isLiked: false }));
    }

    return NextResponse.json({ posts: enrichedPosts }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/feed/[communityId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
