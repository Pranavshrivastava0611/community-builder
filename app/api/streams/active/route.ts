import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
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

    if (error) throw error;

    return NextResponse.json({ streams });
  } catch (err: any) {
    console.error("Active streams error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
