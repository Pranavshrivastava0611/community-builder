import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { room, status } = await request.json();

    if (!room) return NextResponse.json({ error: "Room required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("live_streams")
      .upsert(
        { 
            community_id: room,
            room_name: room, 
            status: status, 
            updated_at: new Date().toISOString() 
        },
        { onConflict: 'room_name' }
      );

    if (error) {
        console.error("Stream status error:", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
    const room = request.nextUrl.searchParams.get("room");
    if (!room) return NextResponse.json({ error: "Room required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from("live_streams")
        .select("*")
        .eq("room_name", room)
        .maybeSingle();

    return NextResponse.json({ stream: data });
}
