import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
  req: Request,
  { params }: { params: Promise<{ communityId: string }> }
) {
  const { communityId } = await params;
  try {

    // Fetch last 50 messages
    // We try to join with profiles if possible, otherwise just raw data
    // Assuming 'profiles' table exists and FK is set up, otherwise this join might fail.
    // Safest MVP: Just fetch messages. Frontend handles user display via wallet/userId.
    
    const { data: messages, error } = await supabaseAdmin
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

    if (error) {
      // Fallback if relation doesn't exist
      const { data: rawMessages, error: rawError } = await supabaseAdmin
          .from("community_chat_messages")
          .select("*")
          .eq("community_id", communityId)
          .order("created_at", { ascending: false })
          .limit(50);
          
       if (rawError) throw rawError;
       return NextResponse.json({ messages: rawMessages?.reverse() });
    }

    return NextResponse.json({ messages: messages?.reverse() }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/chat/[communityId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
