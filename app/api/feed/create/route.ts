import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || "https://api.devnet.solana.com");

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
    // 1. Auth Logic
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorizationHeader.split(" ")[1];
    
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: "Config Error" }, { status: 500 });

    let userId: string;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch {
        return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }

    // 2. Body Parser
    const { communityId, content, imageUrl, tags, isNsfw } = await req.json();

    if (!communityId || (!content?.trim() && !imageUrl)) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 3. Logic: Token Gating & Membership
    // First, verify membership (sanity check)
    const { data: member } = await supabaseAdmin
        .from("community_members")
        .select("id")
        .eq("community_id", communityId)
        .eq("profile_id", userId)
        .single();
    
    if (!member) return NextResponse.json({ error: "Join community to post" }, { status: 403 });

    // Global Feed Requirement: Token Gating
    // Fetch community token info
    const { data: community } = await supabaseAdmin
        .from("communities")
        .select("token_mint_address")
        .eq("id", communityId)
        .single();

    if (community?.token_mint_address) {
        // Fetch user wallet
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("public_key")
            .eq("id", userId)
            .single();

        if (!profile?.public_key) {
            return NextResponse.json({ error: "Connect wallet to post" }, { status: 403 });
        }

        try {
            const mint = new PublicKey(community.token_mint_address);
            const owner = new PublicKey(profile.public_key);
            
            // Check balance
            const response = await connection.getParsedTokenAccountsByOwner(owner, { mint });
            const amount = response.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
            if (amount <= 0) {
                return NextResponse.json({ error: "Buy or swap community token to post" }, { status: 403 });
            }
        } catch (e) {
            console.error("Token check failed", e);
            return NextResponse.json({ error: "Token verification failed" }, { status: 500 });
        }
    }

    // 4. Insert Post
    const { data: postData, error: postError } = await supabaseAdmin
        .from("posts")
        .insert({
            community_id: communityId,
            author_id: userId,
            content,
            post_type: imageUrl ? 'image' : 'text',
            tags: tags || [],
            is_nsfw: isNsfw || false
        })
        .select()
        .single();

    if (postError) {
        console.error("Post create error:", postError);
        return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }

    // 5. Handle Image (if exists)
    if (imageUrl) {
        const { error: mediaError } = await supabaseAdmin
            .from("media")
            .insert({
                post_id: postData.id,
                community_id: communityId,
                uploader_id: userId,
                media_type: 'image',
                file_url: imageUrl
            });

        if (mediaError) {
            console.error("Media insert error:", mediaError);
            // We don't fail the whole request but log it
        }
    }

    // 6. Reputation System: Increment Karma (+10 for posting) - Silent fail if column missing
    try {
        const { error: rpcError } = await supabaseAdmin.rpc('increment_karma', { row_id: userId, amount: 10 });
        if (rpcError && rpcError.code === '42703') {
            // Column doesn't exist yet, ignore
        } else if (rpcError) {
            // Fallback manual update
            const { data: currentProfile } = await supabaseAdmin.from('profiles').select('karma').eq('id', userId).maybeSingle();
            if (currentProfile) {
                await supabaseAdmin.from('profiles').update({ karma: (currentProfile.karma || 0) + 10 }).eq('id', userId);
            }
        }
    } catch (e) {
        // Suppress reputation errors to avoid blocking the main action
        console.warn("Karma update skipped (likely missing column)");
    }

    return NextResponse.json({ post: postData }, { status: 200 });

  } catch (error: any) {
    console.error("API /api/feed/create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
