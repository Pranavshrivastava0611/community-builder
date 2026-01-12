import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, clusterApiUrl } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
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

    // Ensure user ID and public key exist in token payload
    if (!decodedToken.id || !decodedToken.public_key) {
      return NextResponse.json({ error: 'Invalid token payload (missing user ID or public key)' }, { status: 401 });
    }
    const creatorProfileId = decodedToken.id;
    const creatorPublicKey = new PublicKey(decodedToken.public_key);
    console.log('Authenticated user ID:', creatorPublicKey.toBase58());

    // 2. Extract token creation parameters from request body
    const { communityId, tokenName, tokenSymbol, tokenMetadataUri, tokenDecimals, initialSupply, mintAuthority, freezeAuthority, payerPublicKey } = await req.json();

    if (!tokenSymbol || tokenDecimals === undefined || initialSupply === undefined || !payerPublicKey) {
      return NextResponse.json({ error: 'Missing token creation parameters' }, { status: 400 });
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || clusterApiUrl('devnet'), 'confirmed');

    // Derive the user's public key from the request (this user will sign the transaction on frontend)
    const userPayerPublicKey = new PublicKey(payerPublicKey);
    console.log('User payer public key:', userPayerPublicKey.toBase58());

    // Generate a new Keypair for the token mint account itself.
    const mintKeypair = Keypair.generate();

    // Determine mint and freeze authorities. If not provided, use the user's wallet.
    const mintAuthorityPubkey = mintAuthority ? new PublicKey(mintAuthority) : userPayerPublicKey;
    const freezeAuthorityPubkey = freezeAuthority ? new PublicKey(freezeAuthority) : userPayerPublicKey;

    // 3. Create SPL Token Mint transaction
    const transaction = new Transaction();

    // Calculate rent for the mint account
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    // Add instruction to create the mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: userPayerPublicKey, // user's wallet pays for rent
        newAccountPubkey: mintKeypair.publicKey,
        lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenDecimals,
        mintAuthorityPubkey,
        freezeAuthorityPubkey,
        TOKEN_PROGRAM_ID
      )
    );

    // 4. If initialSupply > 0, mint tokens to the creator's ATA.
    let creatorATA: PublicKey | undefined;
    if (initialSupply > 0) {
      const tokenAmount = initialSupply * (10 ** tokenDecimals); // Amount with decimals

      // Get or create associated token account for the creator
      creatorATA = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        creatorPublicKey,
        false, // allowOwnerOffCurve
        TOKEN_PROGRAM_ID
      );

      // Check if ATA exists (this requires an RPC call)
      const ataAccountInfo = await connection.getAccountInfo(creatorATA);
      if (ataAccountInfo === null) {
        // ATA does not exist, add instruction to create it
        transaction.add(
          createAssociatedTokenAccountInstruction(
            userPayerPublicKey, // User's wallet pays for ATA creation
            creatorATA,
            creatorPublicKey,
            mintKeypair.publicKey,
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Add instruction to mint tokens to the creator's ATA
      transaction.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          creatorATA,
          mintAuthorityPubkey, // Mint authority signs this
          tokenAmount,
          [], // Signers if any, but mint authority is enough
          TOKEN_PROGRAM_ID
        )
      );
    }

    // 4b. Create Metadata Account (Metaplex)
    if (tokenName && tokenMetadataUri) {
      const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      // Manual Borsh-style serialization for CreateMetadataAccountV3
      const nameBuf = Buffer.from(tokenName.slice(0, 32));
      const symbolBuf = Buffer.from(tokenSymbol.slice(0, 10));
      const uriBuf = Buffer.from(tokenMetadataUri.slice(0, 200));

      // Calculate buffer size: 
      // 1 (disc) + 4+name + 4+symbol + 4+uri + 2 (fee) + 1 (opt creator) + 1 (opt collection) + 1 (opt uses) + 1 (isMutable) + 1 (opt collectionDetails)
      const dataSize = 1 + (4 + nameBuf.length) + (4 + symbolBuf.length) + (4 + uriBuf.length) + 2 + 1 + 1 + 1 + 1 + 1;
      const data = Buffer.alloc(dataSize);
      let offset = 0;

      data.writeUInt8(33, offset); // Discriminator for CreateMetadataAccountV3
      offset += 1;

      // DataV2 part
      data.writeUInt32LE(nameBuf.length, offset);
      offset += 4;
      nameBuf.copy(data, offset);
      offset += nameBuf.length;

      data.writeUInt32LE(symbolBuf.length, offset);
      offset += 4;
      symbolBuf.copy(data, offset);
      offset += symbolBuf.length;

      data.writeUInt32LE(uriBuf.length, offset);
      offset += 4;
      uriBuf.copy(data, offset);
      offset += uriBuf.length;

      data.writeUInt16LE(0, offset); // sellerFeeBasisPoints
      offset += 2;

      data.writeUInt8(0, offset); // creators: None
      offset += 1;
      data.writeUInt8(0, offset); // collection: None
      offset += 1;
      data.writeUInt8(0, offset); // uses: None
      offset += 1;

      data.writeUInt8(1, offset); // isMutable: True
      offset += 1;
      data.writeUInt8(0, offset); // collectionDetails: None
      offset += 1;

      const { TransactionInstruction } = await import('@solana/web3.js');
      
      transaction.add(
        new TransactionInstruction({
          keys: [
            { pubkey: metadataPDA, isSigner: false, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: mintAuthorityPubkey, isSigner: true, isWritable: false },
            { pubkey: userPayerPublicKey, isSigner: true, isWritable: true },
            { pubkey: userPayerPublicKey, isSigner: false, isWritable: false }, // updateAuthority
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
          ],
          programId: METADATA_PROGRAM_ID,
          data: data,
        })
      );
    }

    // **Add this blockhash fetch and set:**
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;

    // 5. Partially sign the transaction with the mintKeypair (for mint account creation)
    transaction.feePayer = userPayerPublicKey;
    transaction.partialSign(mintKeypair); // Only sign with mintKeypair

    // 6. Return the serialized transaction to the frontend
    let finalCreatorATA = null;
    if (initialSupply > 0 && typeof creatorATA !== 'undefined') {
      finalCreatorATA = creatorATA.toBase58();
    }

    return NextResponse.json({
      transaction: bs58.encode(transaction.serialize({ requireAllSignatures: false, verifySignatures: false })),
      mintAddress: mintKeypair.publicKey.toBase58(),
      creatorATA: finalCreatorATA,
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Route /api/token/create error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

