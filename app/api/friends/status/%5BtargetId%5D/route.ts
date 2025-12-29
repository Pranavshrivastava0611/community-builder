// @ts-nocheck

import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  try {
    const { targetId } = await params;
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    if (!token) return NextResponse.json({ status: 'none' });
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.id;

    if (userId === targetId) return NextResponse.json({ status: 'self' });

    const { data, error } = await supabaseAdmin
        .from("friendships")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${targetId}`)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .or(`sender_id.eq.${targetId},receiver_id.eq.${targetId}`)
        .maybeSingle();

    if (error) {
        console.error("Status fetch error:", error);
        return NextResponse.json({ status: 'none' });
    }

    if (!data) return NextResponse.json({ status: 'none' });

    // Determine who is who for the return
    return NextResponse.json({ 
        status: data.status, 
        isSender: data.sender_id === userId 
    });

  } catch (error) {
    return NextResponse.json({ status: 'none' });
  }
}
