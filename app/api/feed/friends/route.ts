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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    // 1. Get List of Friends
    const { data: friendships } = await supabaseAdmin
        .from("friendships")
        .select("sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    const friendIds = (friendships || []).map(f => f.sender_id === userId ? f.receiver_id : f.sender_id);
    
    // Include the user's own posts in their "social" feed
    const relevantIds = [...friendIds, userId];

    // 2. Fetch Posts from those users
    const { data: posts, error } = await supabaseAdmin
        .from("posts")
        .select(`
            *,
            user:profiles(username, avatar_url),
            community:communities(name, image_url)
        `)
        .in("author_id", relevantIds)
        .order("created_at", { ascending: false })
        .limit(50);

    if (error) throw error;

    // 3. Check likes for these posts (Optimizing frontend state)
    const { data: userLikes } = await supabaseAdmin
        .from("post_likes")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", posts.map(p => p.id));

    const likedPostIds = new Set(userLikes?.map(l => l.post_id) || []);

    const enriched = posts.map(p => ({
        ...p,
        isLiked: likedPostIds.has(p.id)
    }));

    return NextResponse.json({ posts: enriched });

  } catch (error: any) {
    console.error("Friends Feed Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
