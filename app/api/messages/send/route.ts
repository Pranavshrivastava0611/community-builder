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

    const { conversationId, content, imageUrl, batch } = await req.json();

    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

    const messagesToInsert = batch && Array.isArray(batch) 
        ? batch.map((m: any) => ({
            conversation_id: conversationId,
            sender_id: userId,
            content: m.content || "",
            image_url: m.imageUrl || null
        }))
        : [{
            conversation_id: conversationId,
            sender_id: userId,
            content: content || "",
            image_url: imageUrl || null
        }];

    // 1. Verify user is part of the conversation via the participation matrix
    const { data: participants, error: pError } = await supabaseAdmin
        .from("conversation_participants")
        .select("profile_id")
        .eq("conversation_id", conversationId);
    
    if (pError || !participants) return NextResponse.json({ error: "No conversation found" }, { status: 404 });
    const isMember = participants.some(p => p.profile_id === userId);
    if (!isMember) return NextResponse.json({ error: "Forbidden: Not a participant" }, { status: 403 });

    // 2. Insert Message(s)
    const { data: insertedMessages, error: messageError } = await supabaseAdmin
        .from("messages")
        .insert(messagesToInsert)
        .select(`
            *,
            sender:profiles(username, avatar_url)
        `);

    if (messageError) throw messageError;

    // 3. Update Conversation heartbeat
    await supabaseAdmin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

    // 4. Trigger Notifications for ALL OTHER participants
    const otherParticipants = participants.filter(p => p.profile_id !== userId);
    if (otherParticipants.length > 0) {
        const notifications = otherParticipants.map(p => ({
            user_id: p.profile_id,
            type: 'message',
            actor_id: userId,
            target_id: conversationId,
            is_read: false
        }));

        await supabaseAdmin
            .from("notifications")
            .insert(notifications);
    }

    return NextResponse.json({ messages: insertedMessages });

  } catch (error: any) {
    console.error("Send Message Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
