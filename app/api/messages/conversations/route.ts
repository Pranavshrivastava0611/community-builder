import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: "Config Error" }, { status: 500 });
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Fetch conversations where user is a participant
    // We join with conversation_participants to find ALL types (direct and group)
    const { data: participations, error: pError } = await supabaseAdmin
      .from("conversation_participants")
      .select(`
        conversation_id,
        conversation:conversations (
            *,
            participants:conversation_participants (
                profile:profiles (id, username, avatar_url)
            )
        )
      `)
      .eq("profile_id", userId);

    if (pError) throw pError;

    const formatted = (participations || []).map(p => {
        const conv = p.conversation as any;
        if (conv.is_group) {
            return {
                id: conv.id,
                isGroup: true,
                name: conv.name,
                avatar_url: conv.avatar_url,
                last_message_at: conv.last_message_at,
                participantCount: conv.participants?.length || 0
            };
        } else {
            // Find the OTHER user in a 1-on-1
            const otherPart = conv.participants?.find((part: any) => part.profile.id !== userId);
            return {
                id: conv.id,
                isGroup: false,
                last_message_at: conv.last_message_at,
                otherUser: otherPart?.profile || { username: "Ghost", avatar_url: "" }
            };
        }
    }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    return NextResponse.json({ conversations: formatted });

  } catch (error: any) {
    console.error("Conversations GET Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    const { targetUserId } = await req.json();
    if (!targetUserId) return NextResponse.json({ error: "Target missing" }, { status: 400 });

    // 1. Check if a non-group conversation already exists between these two
    // Advanced Query: Find conversations with is_group=false that have BOTH users
    const { data: existing, error: eError } = await supabaseAdmin
        .from("conversation_participants")
        .select("conversation_id, conversation:conversations!inner(is_group)")
        .eq("profile_id", userId)
        .eq("conversation.is_group", false);
    
    // Of those, check if targetUserId is also in any of them
    if (existing && existing.length > 0) {
        const convIds = existing.map(e => e.conversation_id);
        const { data: common } = await supabaseAdmin
            .from("conversation_participants")
            .select("conversation_id")
            .in("conversation_id", convIds)
            .eq("profile_id", targetUserId)
            .maybeSingle();
        
        if (common) return NextResponse.json({ conversationId: common.conversation_id });
    }

    // 2. Create new P2P Conversation
    const { data: created, error: createError } = await supabaseAdmin
      .from("conversations")
      .insert({
        is_group: false,
        last_message_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (createError) throw createError;

    // 3. Add both participants
    await supabaseAdmin
        .from("conversation_participants")
        .insert([
            { conversation_id: created.id, profile_id: userId },
            { conversation_id: created.id, profile_id: targetUserId }
        ]);

    return NextResponse.json({ conversationId: created.id });

  } catch (error: any) {
    console.error("Conversations POST Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
