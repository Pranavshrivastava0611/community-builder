"use client"

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import {
  WalletModalProvider
} from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import React, { useMemo } from 'react';
import "./globals.css";

import { signInWithSolana } from '../services/auth';

function SignInButton() {
  const { publicKey, signMessage, connected } = useWallet();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!publicKey || !signMessage) {
        throw new Error('Wallet not connected or signMessage not available');
      }
      const res = await signInWithSolana(publicKey, signMessage as any);
      if (res.error) throw new Error(res.error?.message || String(res.error));
      console.log('Signed in user:', res.user, 'token:', res.token);
    } catch (e: any) {
      setError(e?.message || String(e));
      console.error('Sign-in failed', e);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) return null;

  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 50 }}>
      <button onClick={handleSignIn} disabled={loading} style={{ padding: '6px 10px' }}>
        {loading ? 'Signing...' : 'Sign in with Wallet'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 6 }}>{error}</div>}
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    [network]
  );
  return (
    <html lang="en">
      <body
      >
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <SignInButton />
              {children}
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
