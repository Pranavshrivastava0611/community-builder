import { getCache, setCache } from "@/utils/redis";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const cacheKey = "all_active_streams";
    const cached = await getCache(cacheKey);
    
    // Always fetch daily new data in dev to avoid confusion
    if (cached && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ streams: cached });
    }

    console.log("Fetching active streams from DB...");
    const { data: streams, error } = await supabaseAdmin
      .from("live_streams")
      .select(`
        *,
        community:communities (
          id,
          name,
          image_url,
          token_symbol
        )
      `)
      .eq("status", "live")
      .order("updated_at", { ascending: false });

    if (error) {
        console.error("Supabase active streams error:", error);
        throw error;
    }

    // Filter out streams without a valid community join if we want clean UI, 
    // but log those that are missing to help debug.
    const validStreams = streams?.filter(s => s.community) || [];
    const invalidStreams = streams?.filter(s => !s.community) || [];

    if (invalidStreams.length > 0) {
        console.warn(`Detected ${invalidStreams.length} streams with missing community metadata:`, 
            invalidStreams.map(s => ({ room: s.room_name, community_id: s.community_id }))
        );
    }

    console.log(`Neural Directory Sync: ${validStreams.length} valid links found.`);

    if (validStreams.length > 0) await setCache(cacheKey, validStreams, 30);

    return NextResponse.json({ streams: validStreams });
  } catch (err: any) {
    console.error("Active streams hub error:", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}
