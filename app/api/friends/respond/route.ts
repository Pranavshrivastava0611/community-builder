import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const decoded: any = jwt.verify(token!, process.env.JWT_SECRET!);
    const userId = decoded.id;

    const { senderId, action } = await req.json(); // action: 'accept' or 'decline'

    if (action === 'accept') {
        const { error } = await supabaseAdmin
            .from("friendships")
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq("sender_id", senderId)
            .eq("receiver_id", userId);

        if (error) throw error;

        // Clear the incoming notification for this user so they don't see it again
        await supabaseAdmin
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", userId)
            .eq("actor_id", senderId)
            .eq("type", "friend_request");

        // Notify the original sender that their request was accepted
        await supabaseAdmin
            .from("notifications")
            .insert({
                user_id: senderId,
                type: 'friend_accept',
                actor_id: userId,
                target_id: userId,
                is_read: false
            });

        return NextResponse.json({ success: true, status: 'accepted' });
    } else {
        // Decline/Cancel
        await supabaseAdmin
            .from("friendships")
            .delete()
            .eq("sender_id", senderId)
            .eq("receiver_id", userId);

        // Clear the notification on decline as well
        await supabaseAdmin
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", userId)
            .eq("actor_id", senderId)
            .eq("type", "friend_request");

        return NextResponse.json({ success: true, status: 'none' });
    }

  } catch (error: any) {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
