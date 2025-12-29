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

    const { postId, content } = await req.json();
    if (!postId || !content?.trim()) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    // Insert Comment
    const { data: comment, error } = await supabaseAdmin
        .from("comments")
        .insert({
            post_id: postId,
            author_id: userId,
            content
        })
        .select()
        .single();
    
    if (error) {
        console.error("Comment error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    // NOTIFICATION logic
    const { data: post } = await supabaseAdmin.from("posts").select("author_id").eq("id", postId).single();
    if (post && post.author_id !== userId) {
        await supabaseAdmin.from("notifications").insert({
            user_id: post.author_id,
            type: 'comment',
            actor_id: userId,
            target_id: postId,
            is_read: false
        });
    }

    return NextResponse.json({ comment }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/feed/comment error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
