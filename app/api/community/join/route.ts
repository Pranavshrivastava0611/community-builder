import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
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

export async function POST(req: Request) {
  try {
    // 1. Auth Check
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorizationHeader.split(" ")[1];
    
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = decodedToken.id;

    // 2. Parse Body
    const { communityId } = await req.json();
    if (!communityId) {
      return NextResponse.json({ error: "Community ID required" }, { status: 400 });
    }

    // 3. Check if already joined
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("community_members")
      .select("id")
      .eq("community_id", communityId)
      .eq("profile_id", userId)
      .single();

    if (existing) {
      return NextResponse.json({ message: "Already joined" }, { status: 200 }); // Not an error
    }

    // 4. Join
    const { error: insertError } = await supabaseAdmin
      .from("community_members")
      .insert({
        community_id: communityId,
        profile_id: userId,
        role: "member", // Default role
      });

    if (insertError) {
      console.error("Join error:", insertError);
      return NextResponse.json({ error: "Failed to join community" }, { status: 500 });
    }

    return NextResponse.json({ message: "Joined successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/community/join error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
