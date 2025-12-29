import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

// Initialize Supabase client with service role key for admin operations
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryUsername = searchParams.get("username");

    // Public Fetch by Username
    if (queryUsername) {
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('id, public_key, username, bio, avatar_url')
            .eq("username", queryUsername)
            .maybeSingle();
        
        if (error) throw error;
        if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        return NextResponse.json({ profile });
    }

    // Existing Private Fetch (Self)
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authorizationHeader.split(' ')[1];
    const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decodedToken.id;

    const { data: profile, error: fetchProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, public_key, username, bio, avatar_url')
      .eq('id', userId)
      .single();

    if (fetchProfileError) throw fetchProfileError;
    return NextResponse.json({ profile }, { status: 200 });

  } catch (error: any) {
    console.error('API Route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// 4. Update the user's profile
export async function PATCH(req: Request) {
  try {
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorizationHeader.split(' ')[1];
    const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decodedToken.id;

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { username, bio, avatar_url } = await req.json();

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ username, bio, avatar_url })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update profile error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ profile: updatedProfile }, { status: 200 });

  } catch (error: any) {
    console.error('PATCH profile error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
