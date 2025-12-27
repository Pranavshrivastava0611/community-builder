import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: "Config Error" }, { status: 500 });

    let userId;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch { return NextResponse.json({ error: "Invalid Token" }, { status: 401 }); }

    // Fetch memberships + Community Names
    const { data: memberships, error } = await supabaseAdmin
        .from("community_members")
        .select(`
            community:communities(id, name, image_url)
        `)
        .eq("profile_id", userId);

    if (error) {
        return NextResponse.json({ error: "Failed to fetch communities" }, { status: 500 });
    }

    // Flatten structure
    const communities = memberships?.map((m: any) => m.community) || [];

    return NextResponse.json({ communities }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
