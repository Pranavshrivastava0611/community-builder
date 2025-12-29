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
        .maybeSingle();
    
    if (existing) {
        // UNLIKE - Use batched parallel operations
        const { data: post } = await supabaseAdmin.from("posts").select("like_count, author_id").eq("id", postId).maybeSingle();
        if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

        // Execute all operations in parallel with Promise.allSettled for fault tolerance
        await Promise.allSettled([
            // Delete like
            supabaseAdmin.from("post_likes").delete().eq("id", existing.id),
            
            // Update like count
            supabaseAdmin.from("posts").update({ like_count: Math.max(0, post.like_count - 1) }).eq("id", postId),
            
            // Karma updates (non-blocking)
            (async () => {
                try {
                    await supabaseAdmin.rpc('increment_karma', { row_id: userId, amount: -1 });
                } catch {
                    const { data: lp } = await supabaseAdmin.from('profiles').select('karma').eq('id', userId).maybeSingle();
                    if (lp) await supabaseAdmin.from('profiles').update({ karma: Math.max(0, (lp.karma || 0) - 1) }).eq('id', userId);
                }
            })(),
            
            (async () => {
                try {
                    await supabaseAdmin.rpc('increment_karma', { row_id: post.author_id, amount: -5 });
                } catch {
                    const { data: ap } = await supabaseAdmin.from('profiles').select('karma').eq('id', post.author_id).maybeSingle();
                    if (ap) await supabaseAdmin.from('profiles').update({ karma: Math.max(0, (ap.karma || 0) - 5) }).eq('id', post.author_id);
                }
            })()
        ]);

        return NextResponse.json({ liked: false });
    } else {
        // LIKE - Use batched parallel operations
        const { data: post } = await supabaseAdmin.from("posts").select("like_count, author_id").eq("id", postId).maybeSingle();
        if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

        // Execute all operations in parallel
        await Promise.allSettled([
            // Insert like
            supabaseAdmin.from("post_likes").insert({ post_id: postId, user_id: userId }),
            
            // Update like count
            supabaseAdmin.from("posts").update({ like_count: post.like_count + 1 }).eq("id", postId),
            
            // Karma updates (non-blocking)
            (async () => {
                try {
                    await supabaseAdmin.rpc('increment_karma', { row_id: userId, amount: 1 });
                } catch {
                    const { data: lp } = await supabaseAdmin.from('profiles').select('karma').eq('id', userId).maybeSingle();
                    if (lp) await supabaseAdmin.from('profiles').update({ karma: (lp.karma || 0) + 1 }).eq('id', userId);
                }
            })(),
            
            (async () => {
                try {
                    await supabaseAdmin.rpc('increment_karma', { row_id: post.author_id, amount: 5 });
                } catch {
                    const { data: ap } = await supabaseAdmin.from('profiles').select('karma').eq('id', post.author_id).maybeSingle();
                    if (ap) await supabaseAdmin.from('profiles').update({ karma: (ap.karma || 0) + 5 }).eq('id', post.author_id);
                }
            })(),
            
            // Notification (only if not self-like)
            post.author_id !== userId ? supabaseAdmin.from("notifications").insert({
                user_id: post.author_id,
                type: 'like',
                actor_id: userId,
                target_id: postId,
                is_read: false
            }) : Promise.resolve()
        ]);

        return NextResponse.json({ liked: true });
    }

  } catch (error: any) {
    console.error("API /api/feed/like error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
