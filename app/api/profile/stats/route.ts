import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    global: { headers: { 'x-connection-pool': 'true' } }
  }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const stat = searchParams.get("stat");

    if (!userId || !stat) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    if (stat === 'posts') {
      // Count posts by this user
      const { count, error } = await supabaseAdmin
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId);

      if (error) {
        console.error('Post count error:', error);
        return NextResponse.json({ count: 0 });
      }

      return NextResponse.json({ count: count || 0 });
    }

    if (stat === 'friends') {
      // Count accepted friendships where user is either sender or receiver
      const { count, error } = await supabaseAdmin
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (error) {
        console.error('Friend count error:', error);
        return NextResponse.json({ count: 0 });
      }

      return NextResponse.json({ count: count || 0 });
    }

    return NextResponse.json({ error: "Invalid stat type" }, { status: 400 });

  } catch (error: any) {
    console.error('Profile stats API error:', error);
    return NextResponse.json({ count: 0 });
  }
}
