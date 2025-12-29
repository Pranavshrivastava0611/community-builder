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
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    const { name, participantIds, avatarUrl } = await req.json();

    if (!name || !participantIds || !Array.isArray(participantIds)) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 1. Create Conversation Head
    const { data: conversation, error: convError } = await supabaseAdmin
        .from("conversations")
        .insert({
            is_group: true,
            name,
            avatar_url: avatarUrl || null,
            creator_id: userId,
            last_message_at: new Date().toISOString()
        })
        .select()
        .single();

    if (convError) throw convError;

    // 2. Add Participants (including creator)
    const allParticipants = [...new Set([...participantIds, userId])];
    const participantData = allParticipants.map(pid => ({
        conversation_id: conversation.id,
        profile_id: pid,
        role: pid === userId ? 'admin' : 'member'
    }));

    const { error: partError } = await supabaseAdmin
        .from("conversation_participants")
        .insert(participantData);

    if (partError) throw partError;

    // 3. Send System Message
    await supabaseAdmin.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: userId, // Creator is sender
        content: `🚨 GROUP CREATED: "${name}" initialized. Welcome to the encrypted dialogue.`,
    });

    return NextResponse.json({ conversationId: conversation.id });

  } catch (error: any) {
    console.error("Group Create Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
