import { delCache, getCache, setCache } from "@/utils/redis";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { room, status, streamerId, streamerName, communityId } = await request.json();
    console.log(`Status Sync Request: Room=${room}, Status=${status}, Community=${communityId}, Streamer=${streamerName}`);

    if (!room) return NextResponse.json({ error: "Room required" }, { status: 400 });

    const streamData = { 
        community_id: communityId, // Explicitly use communityId
        room_name: room, 
        status: status, 
        streamer_id: streamerId,
        streamer_name: streamerName,
        updated_at: new Date().toISOString() 
    };

    const { data, error } = await supabaseAdmin
      .from("live_streams")
      .upsert(
        streamData,
        { onConflict: 'room_name' }
      )
      .select();

    if (error) {
        console.error("Supabase upsert failure:", error);
    } else {
        console.log("Supabase upsert success:", data?.[0]?.room_name);
    }

    // Invalidate Community Cache
    const communityCacheKey = `community_streams:${communityId || room}`;
    await delCache(communityCacheKey);

    // Invalidate Global Directory Cache
    await delCache("all_active_streams");

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Internal Error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
    const room = request.nextUrl.searchParams.get("room");
    const communityId = request.nextUrl.searchParams.get("communityId");

    if (communityId) {
        // Fetch all active streams for a community
        const cacheKey = `community_streams:${communityId}`;
        const cached = await getCache(cacheKey);
        if (cached) return NextResponse.json({ streams: cached });

        const { data, error } = await supabaseAdmin
            .from("live_streams")
            .select("*")
            .eq("community_id", communityId)
            .eq("status", "live");
        
        if (data) await setCache(cacheKey, data, 300);
        return NextResponse.json({ streams: data || [] });
    }

    if (!room) return NextResponse.json({ error: "Room or communityId required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from("live_streams")
        .select("*")
        .eq("room_name", room)
        .maybeSingle();

    return NextResponse.json({ stream: data });
}
