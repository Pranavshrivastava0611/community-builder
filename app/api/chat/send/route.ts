import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

// Initialize Supabase Admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(req: Request) {
  try {
    // 1. Auth Check (JWT)
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorizationHeader.split(" ")[1];
    
    // Validate Token
    if (!process.env.JWT_SECRET) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    let userId: string;
    let wallet: string;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        wallet = decoded.public_key || decoded.wallet; // Assuming payload has wallet
    } catch {
        return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }

    // 2. Parse Body
    const { communityId, message, messages, type = 'text' } = await req.json();

    if (!communityId || (!message && (!messages || messages.length === 0))) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 3. Check Membership (Access Control)
    const { data: membership } = await supabaseAdmin
        .from("community_members")
        .select("id")
        .eq("community_id", communityId)
        .eq("profile_id", userId)
        .single();

    if (!membership) {
        return NextResponse.json({ error: "You must join the community to chat." }, { status: 403 });
    }

    // 4. Handle Batch or Single Insert
    const messagesToInsert = messages 
        ? messages.map((m: string) => ({
            community_id: communityId,
            user_id: userId,
            wallet: wallet || "Unknown",
            message: m,
            type
        }))
        : [{
            community_id: communityId,
            user_id: userId,
            wallet: wallet || "Unknown",
            message,
            type: message.type || type
        }];

    const { data: insertedMessages, error: insertError } = await supabaseAdmin
        .from("community_chat_messages")
        .insert(messagesToInsert)
        .select("*");

    if (insertError) {
        console.error("Chat insert error:", insertError);
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // 5. Broadcast for higher reliability
    try {
        await supabaseAdmin
            .channel(`room:${communityId}`)
            .send({
                type: 'broadcast',
                event: 'new-batch',
                payload: { messages: insertedMessages }
            });
    } catch (e) {
        console.error("Broadcast error:", e);
    }

    return NextResponse.json({ 
        message: insertedMessages?.[0], 
        messages: insertedMessages 
    }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/chat/send error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
