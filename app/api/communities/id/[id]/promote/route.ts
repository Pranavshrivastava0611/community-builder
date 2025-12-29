import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    // 1. Verify if user is the leader/creator of this community
    const { data: community } = await supabaseAdmin
      .from("communities")
      .select("creator_id")
      .eq("id", communityId)
      .single();

    if (!community || community.creator_id !== userId) {
      return NextResponse.json({ error: "Only the community leader can assign roles" }, { status: 403 });
    }

    // 2. Extract target profile and new role
    const { targetProfileId, role = 'moderator' } = await req.json();

    // 3. Update the member's role
    const { error: updateError } = await supabaseAdmin
      .from("community_members")
      .update({ role })
      .eq("community_id", communityId)
      .eq("profile_id", targetProfileId);

    if (updateError) throw updateError;

    return NextResponse.json({ message: "Role updated successfully" });
  } catch (error: any) {
    console.error("Promotion Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
