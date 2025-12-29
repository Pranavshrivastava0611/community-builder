import { PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import * as nacl from 'tweetnacl';

export async function POST(req: Request) {
  try {
    // Validate incoming JSON body early
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { publicKey, signature, message } = body;

    if (!publicKey || !signature || !message) {
      return NextResponse.json({ error: 'Missing authentication data' }, { status: 400 });
    }
    
    // Validate required env vars and create Supabase client here (avoid module-init issues)
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY
      
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase config missing:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY });
      return NextResponse.json({ error: 'Server misconfiguration: Supabase not configured' }, { status: 500 });
    }

    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not set.');
      return NextResponse.json({ error: 'Server misconfiguration: JWT secret not configured' }, { status: 500 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify signature
    const messageBytes = new TextEncoder().encode(message);
    let signatureBytes: Uint8Array;
    try {
      signatureBytes = bs58.decode(signature);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid signature encoding' }, { status: 400 });
    }

    let walletPublicKey: PublicKey;
    try {
      walletPublicKey = new PublicKey(publicKey);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid public key' }, { status: 400 });
    }

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      walletPublicKey.toBytes()
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Find or create profile
    const { data: existingProfile, error: fetchProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, public_key, username')
      .eq('public_key', publicKey)
      .maybeSingle();

    if (fetchProfileError) {
      console.error('Error fetching profile:', fetchProfileError);
      return NextResponse.json({ error: fetchProfileError.message || 'Database error' }, { status: 500 });
    }

    let profileData = existingProfile;
    if (!profileData) {
      const adjectives = ["Fast", "Vibrant", "Neon", "Silent", "Quantum", "Hidden", "Solar", "Glitch", "Infinite", "Cyber", "Brave", "Wandering"];
      const nouns = ["Phoenix", "Voyager", "Matrix", "Knight", "Aura", "Nova", "Nomad", "Pixel", "Citizen", "Oracle", "Phantom", "Pulse"];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit number
      
      const newProfileId = (globalThis as any).crypto?.randomUUID?.() || String(Date.now());
      const defaultUsername = `${randomAdj}-${randomNoun}-${randomNum}`;
      const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${defaultUsername}`;

      const { data: createdProfile, error: insertProfileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newProfileId,
          public_key: publicKey,
          username: defaultUsername,
          avatar_url: defaultAvatar
        })
        .select('id, public_key, username, avatar_url')
        .maybeSingle();

      if (insertProfileError) {
        console.error('Error inserting new profile:', insertProfileError);
        return NextResponse.json({ error: insertProfileError.message || 'Insert failed' }, { status: 500 });
      }
      profileData = createdProfile;
    }

    if (!profileData) {
      return NextResponse.json({ error: 'User profile not found or created' }, { status: 500 });
    }

    // Sign JWT
    const token = jwt.sign(
      {
        id: profileData.id,
        public_key: profileData.public_key,
        username: profileData.username,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      },
      JWT_SECRET,
      { algorithm: 'HS256' }
    );

    return NextResponse.json(
      {
        user: {
          id: profileData.id,
          public_key: profileData.public_key,
          username: profileData.username,
        },
        token,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API Route unexpected error:', error);
    // Always return valid JSON
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
