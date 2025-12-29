import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: "Server Error" }, { status: 500 });
    let userId;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch { return NextResponse.json({ error: "Invalid Token" }, { status: 401 }); }

    const { postId } = await req.json();
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    // 1. Check existing like
    const { data: existing } = await supabaseAdmin
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .single();
    
    if (existing) {
        // UNLIKE
        await supabaseAdmin.from("post_likes").delete().eq("id", existing.id);
        // Decrement count (naive approach)
        // Ideally use RPC: increment_likes(postId, -1)
        // We'll read-modify-write for MVP, or just ignore exact count consistency race condition
        const { data: post } = await supabaseAdmin.from("posts").select("like_count").eq("id", postId).single();
        if (post) {
             await supabaseAdmin.from("posts").update({ like_count: Math.max(0, post.like_count - 1) }).eq("id", postId);
        }
        return NextResponse.json({ liked: false });
    } else {
        // LIKE
        await supabaseAdmin.from("post_likes").insert({ post_id: postId, user_id: userId });
        const { data: post } = await supabaseAdmin.from("posts").select("like_count, author_id").eq("id", postId).single();
        if (post) {
             await supabaseAdmin.from("posts").update({ like_count: post.like_count + 1 }).eq("id", postId);
             
             // NOTIFICATION
             if (post.author_id !== userId) {
                await supabaseAdmin.from("notifications").insert({
                    user_id: post.author_id,
                    type: 'like',
                    actor_id: userId,
                    target_id: postId,
                    is_read: false
                });
             }
        }
        return NextResponse.json({ liked: true });
    }

  } catch (error: any) {
    console.error("API /api/feed/like error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
