import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

// Initialize Supabase client with service role key for admin operations
// This is purely for database interaction, as authentication is custom JWT based.
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
    // 1. Verify the JWT from the Authorization header
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorizationHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!); // Verify the token
    } catch (err: any) {
      console.error('JWT verification failed:', err);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.id;

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token payload (missing user ID)' }, { status: 401 });
    }

    // 2. Fetch the user's profile from Supabase
    const { data: profile, error: fetchProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, public_key, username, bio, avatar_url')
      .eq('id', userId)
      .single();

    if (fetchProfileError) {
      console.error('Error fetching profile:', fetchProfileError);
      return NextResponse.json({ error: fetchProfileError.message || 'Failed to fetch profile' }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 3. Return the profile data
    return NextResponse.json({ profile }, { status: 200 });

  } catch (error: any) {
    console.error('API Route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
