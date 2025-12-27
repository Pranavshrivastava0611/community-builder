import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    const authHeader = req.headers.get("Authorization");
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

    const { content } = await req.json();
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

export async function DELETE(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    const authHeader = req.headers.get("Authorization");
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

    // Verify ownership
    const { data: post, error: fetchError } = await supabaseAdmin
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .single();
    
    if (fetchError || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.author_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Delete
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
