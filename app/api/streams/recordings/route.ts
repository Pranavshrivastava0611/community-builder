import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { streamerId, roomName, videoUrl, communityId, title } = await request.json();

    if (!streamerId || !videoUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("stream_recordings")
      .insert([
        {
          streamer_id: streamerId,
          room_name: roomName,
          video_url: videoUrl,
          community_id: communityId,
          title: title || `Recording - ${new Date().toLocaleDateString()}`,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error("Supabase insert failure:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, recording: data[0] });

  } catch (err) {
    console.error("Internal Error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
    const streamerId = request.nextUrl.searchParams.get("streamerId");
    const communityId = request.nextUrl.searchParams.get("communityId");

    let query = supabaseAdmin.from("stream_recordings").select("*").order("created_at", { ascending: false });

    if (streamerId) {
        query = query.eq("streamer_id", streamerId);
    }
    if (communityId) {
        query = query.eq("community_id", communityId);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ recordings: data || [] });
}
