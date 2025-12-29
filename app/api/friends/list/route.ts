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
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ friends: [] });
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    const { data: friendships } = await supabaseAdmin
        .from("friendships")
        .select(`
            sender_id,
            receiver_id,
            user1:profiles!friendships_sender_id_fkey(id, username, avatar_url),
            user2:profiles!friendships_receiver_id_fkey(id, username, avatar_url)
        `)
        .eq("status", "accepted")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    const friends = (friendships || []).map(f => {
        return f.sender_id === userId ? f.user2 : f.user1;
    });

    return NextResponse.json({ friends });

  } catch (error) {
    return NextResponse.json({ friends: [] });
  }
}
