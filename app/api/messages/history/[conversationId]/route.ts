import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    // 1. Verify user is part of conversation and fetch metadata
    const { data: participation, error: pError } = await supabaseAdmin
        .from("conversation_participants")
        .select(`
            conversation:conversations (
                *,
                participants:conversation_participants (
                    profile:profiles (id, username, avatar_url)
                )
            )
        `)
        .eq("conversation_id", conversationId)
        .eq("profile_id", userId)
        .single();
    
    if (pError || !participation) return NextResponse.json({ error: "Forbidden or Not Found" }, { status: 403 });
    const convMetadata = participation.conversation as any;

    // 2. Fetch Messages
    const { data: messages, error } = await supabaseAdmin
        .from("messages")
        .select(`
            *,
            sender:profiles(username, avatar_url)
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);

    if (error) throw error;

    // 3. Mark all messages in this conversation as read for this user (if sender != me)
    await supabaseAdmin
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId);

    return NextResponse.json({ 
        messages, 
        metadata: {
            ...convMetadata,
            otherUser: convMetadata.is_group ? null : convMetadata.participants?.find((p: any) => p.profile.id !== userId)?.profile
        } 
    });

  } catch (error: any) {
    console.error("Fetch Messages Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
