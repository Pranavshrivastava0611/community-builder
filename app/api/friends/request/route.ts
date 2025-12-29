import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    const { targetUserId } = await req.json();

    // 1. Check if friendship already exists (either direction)
    const { data: existing, error: fetchError } = await supabaseAdmin
        .from("friendships")
        .select("status, sender_id")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`)
        .maybeSingle();

    if (fetchError) {
        console.error("Existing friendship check error:", fetchError);
    }

    if (existing) {
        return NextResponse.json({ status: existing.status, message: "Already exists" });
    }

    // 2. Insert Friend Request
    const { error: requestError } = await supabaseAdmin
        .from("friendships")
        .insert({
            sender_id: userId,
            receiver_id: targetUserId,
            status: 'pending'
        });

    if (requestError) throw requestError;

    // 3. Trigger Notification
    await supabaseAdmin
        .from("notifications")
        .insert({
            user_id: targetUserId,
            type: 'friend_request',
            actor_id: userId,
            target_id: userId, // In friendship, the target is the user
            is_read: false
        });

    return NextResponse.json({ success: true, status: 'pending' });

  } catch (error: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
