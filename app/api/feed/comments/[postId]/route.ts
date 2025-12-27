import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { data: comments, error } = await supabaseAdmin
      .from("comments")
      .select(`
        *,
        author:profiles(username, avatar_url)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true }); // Oldest first (chronological)

    if (error) {
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    return NextResponse.json({ comments }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/feed/comments/[postId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
