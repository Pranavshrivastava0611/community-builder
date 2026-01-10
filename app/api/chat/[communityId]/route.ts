import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ communityId: string }> }
) {
  const { communityId } = await context.params;
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");

  try {
    let query = supabaseAdmin
      .from("community_chat_messages")
      .select(`
        *,
        user:profiles (
            username,
            avatar_url
        )
      `)
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(50);

    // If roomId is provided, only fetch messages for that specific room
    // If roomId is NOT provided, we might want to only fetch "global" messages (room_id is null)
    // or both. The user asked to separate them, so if no roomId, we fetch where room_id is null.
    if (roomId) {
      query = query.eq("room_id", roomId);
    } else {
      query = query.is("room_id", null);
    }

    const { data: messages, error } = await query;

    if (error) {
       // Fallback for missing column or relation
       let fallbackQuery = supabaseAdmin
          .from("community_chat_messages")
          .select("*")
          .eq("community_id", communityId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (roomId) {
            fallbackQuery = fallbackQuery.eq("room_id", roomId);
        } else {
            // Check if room_id exists before filtering by null to avoid crash on old schema
            // We just fetch all if it fails, or try a safer check
            fallbackQuery = fallbackQuery.is("room_id", null);
        }

        const { data: rawMessages, error: rawError } = await fallbackQuery;
          
        if (rawError) {
            // Final fallback: just fetch community messages without room filtering
            const { data: finalMessages } = await supabaseAdmin
                .from("community_chat_messages")
                .select("*")
                .eq("community_id", communityId)
                .order("created_at", { ascending: false })
                .limit(50);
            return NextResponse.json({ messages: finalMessages?.reverse() || [] });
        }
        return NextResponse.json({ messages: rawMessages?.reverse() || [] });
    }

    return NextResponse.json({ messages: messages?.reverse() || [] }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/chat/[communityId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
