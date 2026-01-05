import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ postId: string }> }
) {
    try {
        const { postId } = await context.params;
        const authHeader = request.headers.get("Authorization");
        let currentUserId: string | null = null;
        
        if (authHeader?.startsWith("Bearer ") && process.env.JWT_SECRET) {
            try {
                const token = authHeader.split(" ")[1];
                const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.id;
            } catch {}
        }

        const { data: post, error } = await supabaseAdmin
            .from("posts")
            .select(`
                *,
                author:profiles(id, username, avatar_url),
                community:communities(id, name, image_url),
                comments(count),
                media(file_url)
            `)
            .eq("id", postId)
            .single();

        if (error || !post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        // Check if liked by current user
        let isLiked = false;
        if (currentUserId) {
            const { data: like } = await supabaseAdmin
                .from("post_likes")
                .select("id")
                .eq("post_id", postId)
                .eq("user_id", currentUserId)
                .maybeSingle();
            isLiked = !!like;
        }

        const formatted = {
            ...post,
            user: post.author,
            comment_count: Array.isArray(post.comments) ? (post.comments[0]?.count || 0) : (post.comments?.count || 0),
            image_url: Array.isArray(post.media) ? (post.media[0]?.file_url || null) : (post.media?.file_url || null),
            isLiked
        };

        return NextResponse.json({ post: formatted }, { status: 200 });

    } catch (err: any) {
        console.error("GET post error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await context.params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: "Config Error" }, { status: 500 });

    let userId: string;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch {
        return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }

    const { content } = await request.json();
    if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

    // Verify ownership
    const { data: post, error: fetchError } = await supabaseAdmin
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .single();
    
    if (fetchError || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.author_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Update
    const { error: updateError } = await supabaseAdmin
        .from("posts")
        .update({ content })
        .eq("id", postId);

    if (updateError) return NextResponse.json({ error: "Update failed" }, { status: 500 });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await context.params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: "Config Error" }, { status: 500 });

    let userId: string;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch {
        return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }

    // 1. Fetch post and community info
    const { data: post, error: fetchError } = await supabaseAdmin
        .from("posts")
        .select("author_id, community_id")
        .eq("id", postId)
        .single();
    
    if (fetchError || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // 2. Authorization Check
    let isAuthorized = post.author_id === userId;

    if (!isAuthorized) {
        // Check if user is leader/moderator of THIS community
        const { data: member } = await supabaseAdmin
            .from("community_members")
            .select("role")
            .eq("community_id", post.community_id)
            .eq("profile_id", userId)
            .single();
        
        if (member && (member.role === 'leader' || member.role === 'moderator')) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 3. Delete
    const { error: deleteError } = await supabaseAdmin
        .from("posts")
        .delete()
        .eq("id", postId);

    if (deleteError) return NextResponse.json({ error: "Delete failed" }, { status: 500 });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
