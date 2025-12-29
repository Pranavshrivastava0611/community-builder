import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await context.params;
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
    const { data: comment, error: fetchError } = await supabaseAdmin
        .from("comments")
        .select("author_id")
        .eq("id", commentId)
        .single();
    
    if (fetchError || !comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    if (comment.author_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Update
    const { error: updateError } = await supabaseAdmin
        .from("comments")
        .update({ content })
        .eq("id", commentId);

    if (updateError) return NextResponse.json({ error: "Update failed" }, { status: 500 });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await context.params;
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

    // 1. Fetch comment and parent post's community info
    const { data: comment, error: fetchError } = await supabaseAdmin
        .from("comments")
        .select("author_id, posts(community_id)")
        .eq("id", commentId)
        .single();
    
    if (fetchError || !comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    // 2. Authorization Check
    let isAuthorized = comment.author_id === userId;

    if (!isAuthorized && comment.posts) {
        // Check if user is leader/moderator of THIS community
        const communityId = (comment.posts as any).community_id;
        const { data: member } = await supabaseAdmin
            .from("community_members")
            .select("role")
            .eq("community_id", communityId)
            .eq("profile_id", userId)
            .single();
        
        if (member && (member.role === 'leader' || member.role === 'moderator')) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 3. Delete
    const { error: deleteError } = await supabaseAdmin
        .from("comments")
        .delete()
        .eq("id", commentId);

    if (deleteError) return NextResponse.json({ error: "Delete failed" }, { status: 500 });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
