import bs58 from 'bs58';
// We are no longer directly using the supabase client for authentication session management here
// import { supabase } from '../utils/supabase'; 

interface SignInResponse {
  user: any | null;
  token: string | null;
  error: any | null;
}

export async function signInWithSolana(
  publicKey: any,
  signMessage: ((message: Uint8Array) => Promise<Uint8Array | any>) | undefined
): Promise<SignInResponse> {
  try {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected or signMessage not available');
    }
    // Normalize public key to string
    let publicKeyString: string;
    if (typeof publicKey === 'string') {
      publicKeyString = publicKey;
    } else if (typeof publicKey?.toBase58 === 'function') {
      publicKeyString = publicKey.toBase58();
    } else if (typeof publicKey?.toString === 'function') {
      publicKeyString = publicKey.toString();
    } else {
      throw new Error('Invalid publicKey format');
    }

    // 1. Generate a message for the user to sign
    const message = `Sign in to Solana Community with wallet ${publicKeyString} at ${new Date().toISOString()}`;
    const encodedMessage = new TextEncoder().encode(message);

    // 2. Sign the message with the wallet
    const rawSignature = await signMessage(encodedMessage);

    // Normalize signature to Uint8Array
    let signatureBytes: Uint8Array | null = null;
    if (rawSignature instanceof Uint8Array) {
      signatureBytes = rawSignature;
    } else if (Array.isArray(rawSignature)) {
      signatureBytes = Uint8Array.from(rawSignature);
    } else if (rawSignature && rawSignature.signature) {
      const s = rawSignature.signature;
      if (s instanceof Uint8Array) signatureBytes = s;
      else if (Array.isArray(s)) signatureBytes = Uint8Array.from(s);
      else if (typeof s === 'string') signatureBytes = Uint8Array.from(Buffer.from(s, 'base64'));
    }

    if (!signatureBytes) {
      throw new Error('Unable to normalize signature from wallet');
    }

    const signatureBase58 = bs58.encode(signatureBytes);

    // 3. Send public key, message, and signature to the Next.js API route
    const response = await fetch('/api/auth-solana', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: publicKeyString,
        signature: signatureBase58,
        message: message,
      }),
    });

    // Safely parse response body so we don't throw when server returns no JSON
    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON from auth API:', text);
        data = { error: 'Invalid JSON response from server', raw: text };
      }
    }

    if (!response.ok) {
      console.error('API route error:', data?.error || text || response.statusText);
      return { user: null, token: null, error: data?.error || text || 'Authentication failed' };
    }

    // The API route now returns `user` and `token` directly
    const { user, token } = data;

    if (!user || !token) {
      return { user: null, token: null, error: 'Authentication failed: No user or token returned.' };
    }

    return { user, token, error: null };
  } catch (err: any) {
    console.error('Solana sign-in error:', err);
    return { user: null, token: null, error: err?.message || err };
  }
}
