"use client";

import GlassPanel from '@/components/GlassPanel';
import GlowButton from '@/components/GlowButton';
import Navbar from '@/components/Navbar';
import { useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl, Connection, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

// No longer need Pinata API keys on the frontend
// const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
// const PINATA_SECRET = process.env.NEXT_PUBLIC_PINATA_SECRET;

export default function CreateCommunityPage() {
  const router = useRouter();
  const [communityName, setCommunityName] = useState('');
  const [communityDescription, setCommunityDescription] = useState('');
  const [communityImage, setCommunityImage] = useState<File | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('0');
  const [initialSupply, setInitialSupply] = useState('1000000'); // Default to 1M
  const [mintAuthority, setMintAuthority] = useState('');
  const [freezeAuthority, setFreezeAuthority] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { publicKey, sendTransaction, signTransaction } = useWallet();

  // Establish Solana connection
  const connection = useMemo(() => new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || clusterApiUrl('devnet'), 'confirmed'), []);

  useEffect(() => {
    if (publicKey) {
      setMintAuthority(publicKey.toBase58());
      setFreezeAuthority(publicKey.toBase58());
    }
  }, [publicKey]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCommunityImage(e.target.files[0]);
    }
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication token not found.');
    }
    return { 'Authorization': `Bearer ${token}` };
  };

  async function handleCreateLiquidityPool(
    communityId: string,
    tokenMintAddress: string,
    solAmount: number,
    tokenAmount: number,
    tokenDecimals: number,
    createPool: boolean,
    binStep: number,
    feeTier: number,
    initialPrice: number,
    userPublicKey: string
  ) {
    try {
      setLoading(true);
      setSuccess('Creating liquidity pool...');

      const response = await fetch('/api/liquidity/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          communityId,
          tokenMintAddress,
          solAmount,
          tokenAmount,
          tokenDecimals,
          createPool,
          binStep,
          feeTier,
          initialPrice,
          userPublicKey
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create liquidity pool');
      }

      console.log('API Response:', data);

      const serializedTransaction = data.serializedTransaction;
      const lbPairAddress = data.lbPairAddress;

      // Decode the transaction
      const transaction = Transaction.from(bs58.decode(serializedTransaction));

      // Get a fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      if (!publicKey) throw new Error("Wallet not connected");
      if (!transaction.feePayer || !transaction.feePayer.equals(publicKey)) {
        transaction.feePayer = publicKey;
      }

      console.log('Sending transaction...');
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('Transaction sent! Signature:', signature);
      setSuccess(`Transaction sent: ${signature}\nWaiting for confirmation...`);

      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash,
        lastValidBlockHeight: transaction.lastValidBlockHeight!,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('Transaction confirmed!');

      // ============================================
      // RPC VERIFICATION: Verify LB Pair on-chain
      // ============================================
      setSuccess(`Verifying pool initialization on Solana...`);
      let poolExists = false;
      let retries = 0;
      const maxRetries = 30; // Wait up to ~60 seconds
      const lbPairPubkey = new PublicKey(lbPairAddress);

      while (!poolExists && retries < maxRetries) {
        try {
          const accountInfo = await connection.getAccountInfo(lbPairPubkey, 'confirmed');
          if (accountInfo) {
            poolExists = true;
            console.log(`✅ LB Pair account verified on-chain: ${lbPairAddress}`);
            break;
          }
        } catch (e) {
          console.warn("Error checking account info:", e);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries++;
        if (retries % 5 === 0) setSuccess(`Still verifying pool... (${retries}/${maxRetries})`);
      }

      if (!poolExists) {
        throw new Error(`Pool account ${lbPairAddress} failed to initialize on-chain after transaction confirmation. Solana may be congested.`);
      }

      // ============================================
      // UPDATE DB: Save verified address
      // ============================================
      console.log('Updating community record...');
      await fetch('/api/community/update-pool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          communityId,
          lbPairAddress
        })
      });

      setSuccess(`Liquidity pool created and verified!\nPool Address: ${lbPairAddress}`);

      // ============================================
      // Add Initial Liquidity
      // ============================================
      console.log('Adding initial liquidity to pool...');
      const initialSolAmount = 0.1;
      const initialTokenAmount = 1000;

      const tokenAmountBaseUnits = (initialTokenAmount * Math.pow(10, tokenDecimals)).toString();
      const solAmountBaseUnits = (initialSolAmount * Math.pow(10, 9)).toString();

      try {
        const addLiquiditySignature = await handleAddLiquidity(
          communityId,
          lbPairAddress,
          tokenAmountBaseUnits,
          solAmountBaseUnits,
          publicKey.toBase58(),
          100,
        );
        setSuccess(`✅ Liquidity added! Signature: ${addLiquiditySignature.slice(0, 8)}...`);
      } catch (liquidityErr: any) {
        console.warn("Auto-liquidity addition failed:", liquidityErr);
        setSuccess(`⚠️ Community & Pool created, but automatic liquidity addition failed due to network congestion.\n\nPlease add liquidity manually from the community page.`);
        // We gracefully continue to redirect so the user isn't stuck
      }

      // ============================================
      // SUCCESS! Redirect
      // ============================================
      console.log(`🎉 Community created successfully! Redirecting...`);
      // Update success message one last time before redirect if it wasn't the warning above
      setSuccess((prev) => prev?.includes('⚠️') ? prev : `🎉 Community created successfully! Redirecting...`);

      setTimeout(() => router.push('/communities'), 4000);

      return { lbPairAddress };

    } catch (error: any) {
      console.error('Error creating liquidity pool:', error);

      // Enhanced error handling
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Blockhash not found')) errorMessage = 'Transaction expired. Please try again.';
      else if (errorMessage.includes('insufficient funds')) errorMessage = 'Insufficient SOL in wallet.';

      setError(`Failed to create liquidity pool: ${errorMessage}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function handleAddLiquidity(
    communityId: string,
    lbPairAddress: string,
    tokenXAmount: string,
    tokenYAmount: string,
    userPublicKey: string,
    slippageBps: number = 100
  ): Promise<string> {
    try {
      setLoading(true);
      setSuccess('Preparing to add liquidity...');

      // INCREASED DELAY: Wait longer for pool to be fully propagated
      // This gives Solana time to fully commit the pool creation transaction
      console.log('Waiting 12 seconds for pool to propagate on-chain...');
      await new Promise(resolve => setTimeout(resolve, 12000)); // Increased to 12s buffer

      setSuccess('Pool propagated, creating add liquidity transaction...');

      const response = await fetch('/api/liquidity/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          communityId,
          lbPairAddress,
          tokenXAmount,
          tokenYAmount,
          userPublicKey,
          slippageBps,
        }),
      });

      const data = await response.json();

      // Handle WSOL ATA Creation Request from Backend
      if (data.action === 'CREATE_WSOL_ATA') {
        console.log("Creation of WSOL ATA required...");
        setSuccess(data.message || "WSOL Account missing. Please sign to create it.");

        const ataTx = Transaction.from(bs58.decode(data.serializedTransaction));

        // Send ATA creation transaction
        const ataSig = await sendTransaction(ataTx, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });

        setSuccess(`Creating WSOL Account... ${ataSig.slice(0, 8)}`);
        await connection.confirmTransaction(ataSig, 'confirmed');
        console.log("WSOL ATA Created:", ataSig);

        // Retry adding liquidity
        setSuccess("WSOL Account created! Retrying liquidity addition...");
        return handleAddLiquidity(communityId, lbPairAddress, tokenXAmount, tokenYAmount, userPublicKey, slippageBps);
      }

      if (!response.ok) {
        // If we get a 504 timeout, suggest retrying
        if (response.status === 504) {
          throw new Error(`${data.error}\n\nThe pool is still being created. Please wait a moment and try the "Add Liquidity" action again from the community page.`);
        }
        throw new Error(data.error || 'Failed to create add liquidity transaction');
      }

      console.log('Add Liquidity API Response:', data);

      const serializedTransaction = data.serializedTransaction;

      // Decode the transaction
      const transaction = Transaction.from(bs58.decode(serializedTransaction));

      console.log('Debugging Add Liquidity Transaction:');
      console.log('Transaction instructions:', transaction.instructions.length);
      transaction.instructions.forEach((instruction, index) => {
        console.log(`Instruction ${index}:`);
        console.log(`  Program ID: ${instruction.programId.toBase58()}`);
        console.log(`  Keys (${instruction.keys.length}):`,
          instruction.keys.map(key => ({
            pubkey: key.pubkey.toBase58(),
            isSigner: key.isSigner,
            isWritable: key.isWritable
          }))
        );
        console.log(`  Data length:`, instruction.data.length);
      });

      // CRITICAL: Get a fresh blockhash before sending
      try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;

        // Ensure feePayer is set to the connected wallet
        if (!transaction.feePayer || !transaction.feePayer.equals(publicKey!)) {
          transaction.feePayer = publicKey!;
        }

        console.log('Updated with fresh blockhash:', blockhash);
        console.log('Last valid block height:', lastValidBlockHeight);

        // Validate transaction before sending
        if (!transaction.feePayer) {
          throw new Error('Transaction missing feePayer');
        }

        if (!transaction.recentBlockhash) {
          throw new Error('Transaction missing recentBlockhash');
        }

        if (!publicKey) {
          throw new Error('Wallet not connected');
        }

        console.log('Sending add liquidity transaction...');

        setSuccess('Please approve the transaction in your wallet...');

        // Send the transaction with proper options
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        console.log('Add liquidity transaction sent! Signature:', signature);

        setSuccess(`Add liquidity transaction sent: ${signature.slice(0, 8)}...`);

        // Wait for confirmation with the blockhash info
        console.log('Waiting for confirmation...');
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash: transaction.recentBlockhash,
          lastValidBlockHeight: transaction.lastValidBlockHeight!,
        }, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log('Add liquidity transaction confirmed!');
        setSuccess(`✅ Liquidity added successfully!\nBins: ${data.minBinId} to ${data.maxBinId}\nTransaction: ${signature.slice(0, 8)}...`);

        return signature;

      } catch (txError: any) {
        console.error('Add Liquidity Transaction Error Details:', txError);

        // Log transaction logs if available
        if (txError.logs) {
          console.error('Transaction logs:', txError.logs);
        }

        // Provide user-friendly error messages
        let errorMessage = 'Unknown error occurred';

        if (txError.message?.includes('Blockhash not found')) {
          errorMessage = 'Transaction expired. Please try again.';
        } else if (txError.message?.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees. Please add more SOL to your wallet.';
        } else if (txError.message?.includes('User rejected')) {
          errorMessage = 'Transaction rejected by user.';
        } else if (txError.message?.includes('0x1')) {
          errorMessage = 'Insufficient funds for rent or transaction. Please add more SOL.';
        } else if (txError.message?.includes('custom program error: 0x0')) {
          errorMessage = 'Program error: Invalid liquidity parameters or pool state.';
        } else {
          errorMessage = txError.message || String(txError);
        }

        throw new Error(errorMessage);
      }

    } catch (error: any) {
      console.error('Error adding liquidity:', error);
      setError(`Failed to add liquidity: ${error.message || 'Unknown error'}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!publicKey || !sendTransaction) {
      setError('Wallet not connected or transaction sender not available.');
      setLoading(false);
      return;
    }

    // Log user's SOL balance for debugging
    try {
      const balance = await connection.getBalance(publicKey);
      console.log(`User SOL balance: ${balance / 10 ** 9} SOL`);
      if (balance < 0.005 * 10 ** 9) { // Roughly 0.005 SOL as a minimum for fees/rent
        setError('Insufficient SOL in wallet for transaction fees and rent. Please fund your wallet.');
        setLoading(false);
        return;
      }
    } catch (balanceErr: any) {
      console.error('Error fetching SOL balance:', balanceErr);
      // Continue even if balance check fails, as it might be RPC error
    }

    try {
      const authHeader = getAuthHeader();
      let communityImageUri = '';
      let tokenMetadataUri = '';
      let tokenMintAddress = '';
      let communityId = '';

      // 1. Upload community image to IPFS via backend
      if (communityImage) {
        const imageFormData = new FormData();
        imageFormData.append('file', communityImage);
        imageFormData.append('pinataMetadata', JSON.stringify({ name: communityName + '_image' }));

        const imageUploadRes = await fetch('/api/ipfs/upload', {
          method: 'POST',
          headers: authHeader,
          body: imageFormData,
        });

        const imageData = await imageUploadRes.json();
        if (!imageUploadRes.ok) {
          throw new Error(imageData.error || 'Failed to upload community image.');
        }
        communityImageUri = imageData.ipfsGatewayUrl;
        setSuccess('Community image uploaded to IPFS.');
      }

      // 2. Create metadata JSON and upload to IPFS via backend
      const metadata = {
        name: communityName,
        symbol: tokenSymbol,
        description: communityDescription,
        image: communityImageUri, // Use the uploaded image URI
        properties: {
          decimals: parseInt(tokenDecimals),
          initialSupply: parseFloat(initialSupply),
        },
      };
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], `${tokenSymbol}_metadata.json`);

      const metadataFormData = new FormData();
      metadataFormData.append('file', metadataFile);
      metadataFormData.append('pinataMetadata', JSON.stringify({ name: tokenSymbol + '_metadata' }));

      const metadataUploadRes = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: authHeader,
        body: metadataFormData,
      });

      const metadataData = await metadataUploadRes.json();
      if (!metadataUploadRes.ok) {
        throw new Error(metadataData.error || 'Failed to upload token metadata.');
      }
      tokenMetadataUri = metadataData.ipfsGatewayUrl;
      setSuccess('Token metadata uploaded to IPFS.');

      // 3. Create SPL Token via backend and get partially signed transaction
      const tokenCreateRes = await fetch('/api/token/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          // communityId is not available yet, will be added in backend `community/create`
          tokenSymbol,
          tokenDecimals: parseInt(tokenDecimals),
          initialSupply: parseFloat(initialSupply),
          mintAuthority,
          freezeAuthority,
          payerPublicKey: publicKey.toBase58(),
        }),
      });

      const tokenData = await tokenCreateRes.json();
      if (!tokenCreateRes.ok) {
        throw new Error(tokenData.error || 'Failed to prepare token creation transaction.');
      }

      tokenMintAddress = tokenData.mintAddress; // The new mint address
      const serializedTransaction = tokenData.transaction;

      setSuccess(`Token creation transaction prepared. Mint Address: ${tokenMintAddress}`);

      // --- Debugging Serialized Transaction Start ---
      console.log('Raw Serialized Transaction (base58):', serializedTransaction);
      const decodedSerializedTx = bs58.decode(serializedTransaction);
      console.log('Decoded Serialized Transaction (Uint8Array):', decodedSerializedTx);
      // --- Debugging Serialized Transaction End ---

      // Deserialize and sign the transaction on the frontend
      const transaction = Transaction.from(decodedSerializedTx);

      // --- Debugging Transaction Start ---
      console.log('Debugging Transaction:');
      console.log('Transaction instructions:', transaction.instructions);
      transaction.instructions.forEach((instruction, index) => {
        console.log(`Instruction ${index}:`);
        console.log(`  Program ID: ${instruction.programId.toBase58()}`);
        console.log(`  Keys:`, instruction.keys.map(key => ({ pubkey: key.pubkey.toBase58(), isSigner: key.isSigner, isWritable: key.isWritable })));
        console.log(`  Data (base64):`, instruction.data.toString('base64'));
      });
      console.log('Transaction feePayer:', transaction.feePayer?.toBase58());
      console.log('Transaction recentBlockhash:', transaction.recentBlockhash);
      console.log('Transaction signatures:', transaction.signatures);
      // You can further inspect specific instructions if needed
      // console.log('First instruction data:', transaction.instructions[0]?.data.toString('base64'));
      // --- Debugging Transaction End ---ved 

      let signature: string = '';
      try {
        // 4. Send the transaction to the network (user will sign in Phantom)
        signature = await sendTransaction(transaction, connection); // Ensure 'connection' is used
        setSuccess(`Transaction sent: ${signature}`);
      } catch (sendErr: any) {
        console.error('Error sending transaction:', sendErr);
        setError(`Failed to send transaction: ${sendErr.message || sendErr.name || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      try {
        await connection.confirmTransaction(signature, 'confirmed');
        setSuccess(`Transaction confirmed: ${signature}`);
      } catch (confirmErr: any) {
        console.error('Error confirming transaction:', confirmErr);
        setError(`Failed to confirm transaction: ${confirmErr.message || confirmErr.name || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      // 5. Create community record in Supabase via backend
      let communityRecordId = '';
      try {
        const communityCreateRes = await fetch('/api/community/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify({
            name: communityName,
            description: communityDescription,
            image_url: communityImageUri,
            token_mint_address: tokenMintAddress,
            token_metadata_uri: tokenMetadataUri,
          }),
        });

        const communityCreateData = await communityCreateRes.json();

        if (!communityCreateRes.ok) {
          // Handle duplicate community name error specifically
          if (communityCreateRes.status === 409) {
            throw new Error(communityCreateData.error || 'Community with this name already exists.');
          }
          throw new Error(communityCreateData.error || 'Failed to create community record');
        }
        communityRecordId = communityCreateData.communityId;
        setSuccess(`Community \"${communityName}\" created successfully! Redirecting...`);
      } catch (err: any) {
        console.error('Error creating community record:', err);
        setError(`Community Record Creation Failed: ${err.message}`);
        setLoading(false);
        return;
      }

      // 6. Create Liquidity Pool (Meteora Integration)
      // For now, hardcode initial SOL and token amounts for LP
      const initialSolAmount = 0.1; // 0.1 SOL
      const initialTokenAmount = 1000; // 1000 of your new community token
      const binStep = 100; // Example bin step
      const feeTier = 0.0005; // Example fee tier (0.05%)
      const initialPrice = 1.0; // Example initial price (Token / SOL ratio)
      const userPublicKey = publicKey.toBase58();

      console.log(`Adding initial liquidity (${initialSolAmount} SOL, ${initialTokenAmount} ${tokenSymbol}) to the pool...`);
      const { lbPairAddress } = await handleCreateLiquidityPool(
        communityRecordId,
        tokenMintAddress,
        initialSolAmount,
        initialTokenAmount,
        parseInt(tokenDecimals),
        true, // createPool: true, as we want to create a new pool
        binStep,
        feeTier,
        initialPrice,
        userPublicKey,
      );



    } catch (err: any) {
      setError(err.message || 'Failed to create community.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden selection:bg-orange-500/30">

      {/* Background Visuals */}
      <div
        className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none"
        style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)' }}
      ></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none opacity-40"></div>

      <Navbar />
      <main className="relative z-10 flex flex-col items-center justify-center px-4 md:px-8 pt-24 pb-20 max-w-4xl mx-auto animate-fade-in-up">
        <GlassPanel className="p-10 w-full max-w-3xl border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black font-heading mb-4 tracking-tighter">
              Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-200">Community</span>
            </h1>
            <p className="text-gray-400 max-w-lg mx-auto">
              Launch your decentralized community, mint your token, and initialize a liquidity pool in one go.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Community Name</label>
                <input
                  type="text"
                  id="name"
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 placeholder-gray-600"
                  placeholder="e.g. Solana DeFi Explorers"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Description</label>
                <textarea
                  id="description"
                  value={communityDescription}
                  onChange={(e) => setCommunityDescription(e.target.value)}
                  rows={4}
                  className="w-full px-5 py-4 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 placeholder-gray-600 resize-y"
                  placeholder="Describe your community's focus and goals..."
                  required
                ></textarea>
              </div>

              <div className="bg-white/5 p-6 rounded-xl border border-white/5">
                <label htmlFor="image" className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-3">Community Image</label>
                <div className="flex items-center gap-6">
                  <label className="flex-1 cursor-pointer group">
                    <div className="w-full h-32 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 group-hover:border-orange-500/50 group-hover:bg-white/5 transition-all duration-300">
                      <svg className="w-8 h-8 text-gray-500 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-gray-400 group-hover:text-white transition-colors">Click to upload banner</span>
                    </div>
                    <input
                      type="file"
                      id="image"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {communityImage && (
                    <div className="relative group shrink-0">
                      <img
                        src={URL.createObjectURL(communityImage)}
                        alt="Preview"
                        className="h-32 w-32 object-cover rounded-xl border-2 border-orange-500/30 shadow-lg"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-xs text-white">
                        {communityImage.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white border-l-4 border-orange-500 pl-3">Token Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="tokenSymbol" className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Symbol</label>
                  <input
                    type="text"
                    id="tokenSymbol"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                    className="w-full px-5 py-4 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 placeholder-gray-600 font-mono tracking-wider"
                    placeholder="e.g. SLNA"
                    maxLength={10}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tokenDecimals" className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Decimals</label>
                  <input
                    type="number"
                    id="tokenDecimals"
                    value={tokenDecimals}
                    onChange={(e) => setTokenDecimals(e.target.value)}
                    min="0"
                    max="9"
                    className="w-full px-5 py-4 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 placeholder-gray-600 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="initialSupply" className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Initial Supply</label>
                  <input
                    type="number"
                    id="initialSupply"
                    value={initialSupply}
                    onChange={(e) => setInitialSupply(e.target.value)}
                    min="1"
                    className="w-full px-5 py-4 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 placeholder-gray-600 font-mono"
                    placeholder="1000000"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="mintAuthority" className="block text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Mint Authority</label>
                  <input
                    type="text"
                    id="mintAuthority"
                    value={mintAuthority}
                    onChange={(e) => setMintAuthority(e.target.value)}
                    className="w-full px-5 py-4 rounded-xl bg-white/5 text-gray-400 border border-white/10 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 placeholder-gray-600 font-mono text-xs"
                    placeholder="Wallet Address (Optional)"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center animate-pulse">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center whitespace-pre-line animate-fade-in">
                {success}
              </div>
            )}

            <GlowButton type="submit" className="w-full text-lg py-5 font-bold tracking-wide" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Transaction...
                </span>
              ) : (
                'Create Community & Launch Token'
              )}
            </GlowButton>
          </form>
        </GlassPanel>
      </main>
    </div>
  );
}
