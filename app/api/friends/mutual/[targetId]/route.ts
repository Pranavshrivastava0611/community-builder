import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ targetId: string }> }
) {
  try {
    const { targetId } = await context.params;
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    if (!token) return NextResponse.json({ mutualFriends: [], totalCount: 0 });
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    if (userId === targetId) return NextResponse.json({ mutualFriends: [], totalCount: 0 });

    // 1. Get My Friends IDs
    const { data: myFriendsData } = await supabaseAdmin
        .from("friendships")
        .select("sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    
    const myFriends = new Set((myFriendsData || []).map(f => f.sender_id === userId ? f.receiver_id : f.sender_id));

    // 2. Get Target Friends IDs
    const { data: targetFriendsData } = await supabaseAdmin
        .from("friendships")
        .select("sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${targetId},receiver_id.eq.${targetId}`);

    const targetFriends = (targetFriendsData || []).map(f => f.sender_id === targetId ? f.receiver_id : f.sender_id);

    // 3. Find Intersection
    const mutualIds = targetFriends.filter(id => myFriends.has(id));

    if (mutualIds.length === 0) return NextResponse.json({ mutualFriends: [], totalCount: 0 });

    // 4. Fetch Profiles for all mutual friends
    const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", mutualIds);

    return NextResponse.json({ 
        mutualFriends: profiles || [], 
        totalCount: mutualIds.length 
    });

  } catch (error) {
    return NextResponse.json({ mutualFriends: [], totalCount: 0 });
  }
}
