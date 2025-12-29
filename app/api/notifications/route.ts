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
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    // Fetch notifications with actor info
    const { data: notifications, error } = await supabaseAdmin
      .from("notifications")
      .select(`
        *,
        actor:profiles!notifications_actor_id_fkey(username, avatar_url)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    return NextResponse.json({ notifications });

  } catch (error: any) {
    console.error("Notifications GET Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.split(" ")[1];
        
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const userId = decoded.id;
    
        // Mark all as read
        const { error } = await supabaseAdmin
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", userId);
    
        if (error) throw error;
    
        return NextResponse.json({ success: true });
    
      } catch (error: any) {
        console.error("Notifications PATCH Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
      }
}
