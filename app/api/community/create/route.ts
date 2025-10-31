import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';


// Initialize Supabase client for database interaction
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

export async function POST(req: Request) {
  try {
    // 1. Verify JWT for authentication
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

    // Ensure user ID exists in token payload
    if (!decodedToken.id) {
      return NextResponse.json({ error: 'Invalid token payload (missing user ID)' }, { status: 401 });
    }
    const creatorProfileId = decodedToken.id;

    // 2. Extract community creation parameters from request body
    const {
      name,
      description,
      image_url,
      token_mint_address,
      token_metadata_uri,
    } = await req.json();

    if (!name || !description || !image_url || !token_mint_address || !token_metadata_uri) {
      return NextResponse.json({ error: 'Missing required community parameters' }, { status: 400 });
    }

    // 3. Check if a community with the same name already exists
    const { data: existingCommunity, error: checkError } = await supabaseAdmin
      .from('communities')
      .select('id')
      .eq('name', name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error checking for existing community:', checkError);
      return NextResponse.json({ error: 'Database error during name check' }, { status: 500 });
    }

    if (existingCommunity) {
      return NextResponse.json({ error: 'Community with this name already exists.' }, { status: 409 });
    }

    // 4. Insert new community into Supabase `communities` table
    const { data: community, error: communityError } = await supabaseAdmin
      .from('communities')
      .insert({
        name,
        description,
        image_url,
        token_mint_address,
        token_metadata_uri,
        creator_id: creatorProfileId, // Associate community with the creator
      })
      .select('id')
      .single();

    if (communityError) {
      console.error('Error inserting community:', communityError);
      return NextResponse.json({ error: communityError.message || 'Failed to create community' }, { status: 500 });
    }

    if (!community) {
      return NextResponse.json({ error: 'Failed to retrieve created community ID' }, { status: 500 });
    }

    // 4. Add the creator as a member (e.g., as 'leader' role) to `community_members`
    const { error: memberError } = await supabaseAdmin
      .from('community_members')
      .insert({
        community_id: community.id,
        profile_id: creatorProfileId,
        role: 'leader', // Assign a default role like 'leader' or 'admin'
      });

    if (memberError) {
      console.error('Error adding community creator as member:', memberError);
      // Optionally, you might want to roll back the community creation here
      return NextResponse.json({ error: memberError.message || 'Failed to add creator as community member' }, { status: 500 });
    }

    return NextResponse.json({ communityId: community.id, message: 'Community created successfully!' }, { status: 200 });

  } catch (error: any) {
    console.error('API Route /api/community/create error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
