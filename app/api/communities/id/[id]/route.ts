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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: community, error } = await supabaseAdmin
      .from("communities")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    return NextResponse.json({ community }, { status: 200 });
  } catch (error: any) {
    console.error("API /api/communities/id/[id] error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
