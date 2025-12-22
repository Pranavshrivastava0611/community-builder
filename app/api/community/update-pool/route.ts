import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export async function POST(req: Request) {
  try {
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorizationHeader.split(" ")[1];
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { communityId, lbPairAddress } = await req.json();

    if (!communityId || !lbPairAddress) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Verify ownership
    const { data: community, error: fetchError } = await supabaseAdmin
      .from("communities")
      .select("creator_id")
      .eq("id", communityId)
      .single();

    if (fetchError || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (community.creator_id !== decodedToken.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the record
    const { error: updateError } = await supabaseAdmin
      .from("communities")
      .update({ meteora_lb_pair_address: lbPairAddress })
      .eq("id", communityId);

    if (updateError) {
      console.error("Failed to update community:", updateError);
      return NextResponse.json({ error: "Failed to update community" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update pool error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
