"use client";

import GlassPanel from '@/components/GlassPanel';
import GlowBackground from '@/components/GlowBackground';
import GlowButton from '@/components/GlowButton';
import Navbar from '@/components/Navbar';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction, clusterApiUrl } from '@solana/web3.js';
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
  
      console.log('Debugging Liquidity Pool Transaction:');
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
      console.log('Transaction feePayer (before update):', transaction.feePayer?.toBase58());
      console.log('Transaction recentBlockhash (before update):', transaction.recentBlockhash);
  
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
        console.log('Transaction feePayer (after update):', transaction.feePayer?.toBase58());
  
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
  
        console.log('Sending transaction...');
        
        // Send the transaction with proper options
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
  
        console.log('Transaction sent! Signature:', signature);
        
        setSuccess(`Transaction sent: ${signature}`);
  
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
  
        console.log('Transaction confirmed!');
        setSuccess(`Liquidity pool created successfully!\nPool Address: ${lbPairAddress}\nTransaction: ${signature}`);
  
      } catch (txError: any) {
        console.error('Transaction Error Details:', txError);
        
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
          errorMessage = 'Program error: Pool may already exist or invalid parameters.';
        } else {
          errorMessage = txError.message || String(txError);
        }
        
        throw new Error(errorMessage);
      }
       // ============================================
       console.log('Adding initial liquidity to pool...');
       const initialSolAmount = 0.1; // 0.1 SOL
       const initialTokenAmount = 1000; // 1000 of your new community token
       // Convert amounts to base units (with decimals)
       const tokenAmountBaseUnits = (initialTokenAmount * Math.pow(10, parseInt(tokenDecimals))).toString();
       const solAmountBaseUnits = (initialSolAmount * Math.pow(10, 9)).toString(); // SOL has 9 decimals
 
       const addLiquiditySignature = await handleAddLiquidity(
         communityId,
         lbPairAddress,
         tokenAmountBaseUnits,
         solAmountBaseUnits,
         publicKey.toBase58(),
         100, // 1% slippage
       );
 
       setSuccess(`✅ Liquidity added! Signature: ${addLiquiditySignature.slice(0, 8)}...`);
 
       // ============================================
       // SUCCESS! Redirect to communities page
       // ============================================
       setSuccess(`🎉 Community created successfully! Redirecting...`);
       setTimeout(() => router.push('/communities'), 3000);
    } catch (error: any) {
      console.error('Error creating liquidity pool:', error);
      setError(`Failed to create liquidity pool: ${error.message || 'Unknown error'}`);
      throw error; // Re-throw so the main handleSubmit can catch it
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
      console.log('Waiting 8 seconds for pool to propagate on-chain...');
      await new Promise(resolve => setTimeout(resolve, 8000)); // Increased from 3000 to 8000ms
  
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
      console.log(`User SOL balance: ${balance / 10**9} SOL`);
      if (balance < 0.005 * 10**9) { // Roughly 0.005 SOL as a minimum for fees/rent
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
        signature =  await sendTransaction(transaction, connection); // Ensure 'connection' is used
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
     const {lbPairAddress} =  await handleCreateLiquidityPool(
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
    <div className="min-h-screen bg-color-bg-dark relative font-body text-color-text-light overflow-hidden">
      <GlowBackground />
      <Navbar />
      <main className="relative z-10 flex flex-col items-center justify-center px-4 md:px-8 pt-24 pb-12 max-w-4xl mx-auto">
        <GlassPanel className="p-8 w-full max-w-2xl">
          <h1 className="text-4xl font-heading font-extrabold text-center mb-8 bg-linear-to-r from-color-primary to-color-secondary bg-clip-text text-transparent">Create New Community</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-lg font-semibold text-white mb-2">Community Name</label>
              <input
                type="text"
                id="name"
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg"
                placeholder="e.g., Solana DeFi Explorers"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-lg font-semibold text-white mb-2">Description</label>
              <textarea
                id="description"
                value={communityDescription}
                onChange={(e) => setCommunityDescription(e.target.value)}
                rows={4}
                className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg resize-y"
                placeholder="Describe your community's focus and goals..."
                required
              ></textarea>
            </div>
            <div>
              <label htmlFor="image" className="block text-lg font-semibold text-white mb-2">Community Image (Upload)</label>
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg"
              />
              {communityImage && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={URL.createObjectURL(communityImage)}
                    alt="Community Preview"
                    className="h-16 w-16 object-cover rounded-lg border border-color-primary shadow"
                  />
                  <span className="text-white/80">{communityImage.name}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tokenSymbol" className="block text-lg font-semibold text-white mb-2">Token Symbol</label>
                <input
                  type="text"
                  id="tokenSymbol"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg"
                  placeholder="e.g., SOLDEFI"
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label htmlFor="tokenDecimals" className="block text-lg font-semibold text-white mb-2">Token Decimals</label>
                <input
                  type="number"
                  id="tokenDecimals"
                  value={tokenDecimals}
                  onChange={(e) => setTokenDecimals(e.target.value)}
                  min="0"
                  max="9"
                  className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="initialSupply" className="block text-lg font-semibold text-white mb-2">Initial Supply</label>
                <input
                  type="number"
                  id="initialSupply"
                  value={initialSupply}
                  onChange={(e) => setInitialSupply(e.target.value)}
                  min="1"
                  className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg"
                  placeholder="e.g., 1000000"
                  required
                />
              </div>
              <div>
                <label htmlFor="mintAuthority" className="block text-lg font-semibold text-white mb-2">Mint Authority (Base58)</label>
                <input
                  type="text"
                  id="mintAuthority"
                  value={mintAuthority}
                  onChange={(e) => setMintAuthority(e.target.value)}
                  className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg"
                  placeholder="Leave blank to auto-generate (uses your wallet)"
                />
              </div>
            </div>
            <div>
              <label htmlFor="freezeAuthority" className="block text-lg font-semibold text-white mb-2">Freeze Authority (Base58)</label>
              <input
                type="text"
                id="freezeAuthority"
                value={freezeAuthority}
                onChange={(e) => setFreezeAuthority(e.target.value)}
                className="w-full px-5 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-color-primary backdrop-blur-lg"
                placeholder="Leave blank to auto-generate (uses your wallet)"
              />
            </div>
            
            {error && <p className="text-red-400 mt-4 text-center">Error: {error}</p>}
            {success && <p className="text-green-400 mt-4 text-center whitespace-pre-line">{success}</p>}

            <GlowButton type="submit" className="w-full text-xl py-4" disabled={loading}>
              {loading ? 'Creating Community & Token...' : 'Create Community & Launch Token'}
            </GlowButton>
          </form>
        </GlassPanel>
      </main>
    </div>
  );
}
