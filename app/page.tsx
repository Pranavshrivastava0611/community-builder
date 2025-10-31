"use client"

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { signInWithSolana } from '../services/auth';
// @ts-ignore
import jwt from 'jsonwebtoken';

export default function Home() {
  const { publicKey, connected, signMessage, wallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setAuthToken(storedToken);
      try {
        const decodedToken: any = jwt.decode(storedToken);
        if (decodedToken) {
          setCurrentUser({
            id: decodedToken.id,
            public_key: decodedToken.public_key,
            username: decodedToken.username,
          });
        } else {
          localStorage.removeItem('authToken');
          setAuthToken(null);
          setCurrentUser(null);
        }
      } catch (error) {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setCurrentUser(null);
      }
    }
    setTokenChecked(true);
  }, []);

  const authenticateWithSolanaAndJWT = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!wallet || !publicKey || !signMessage) {
        throw new Error("Wallet not connected or signMessage not available.");
      }
      const { user, token, error } = await signInWithSolana(publicKey, signMessage);
      if (error) {
        setAuthToken(null);
        setCurrentUser(null);
        localStorage.removeItem('authToken');
        setAuthError(error.message || 'Authentication failed');
      } else if (user && token) {
        setAuthToken(token);
        setCurrentUser(user);
        localStorage.setItem('authToken', token);
      } else {
        setAuthToken(null);
        setCurrentUser(null);
        localStorage.removeItem('authToken');
        setAuthError("Authentication failed: No user or token returned.");
      }
    } catch (error: any) {
      setAuthToken(null);
      setCurrentUser(null);
      localStorage.removeItem('authToken');
      setAuthError(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, wallet]);

  useEffect(() => {
    if (
      tokenChecked &&
      connected &&
      publicKey &&
      wallet &&
      signMessage &&
      !authToken &&
      !loading
    ) {
      authenticateWithSolanaAndJWT();
    }
  }, [
    tokenChecked,
    connected,
    publicKey,
    wallet,
    signMessage,
    authToken,
    loading,
    authenticateWithSolanaAndJWT,
  ]);

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('authToken');
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-sans">
      <header className="w-full px-8 py-6 flex justify-between items-center border-b border-white/10 shadow-lg">
        <h1 className="text-3xl font-extrabold tracking-tight">Solana Community</h1>
        <div className="flex items-center gap-4">
          <WalletMultiButton />
          {connected && authToken && (
            <Link href="/profile" passHref>
              <button className="px-5 py-2 bg-white text-black font-semibold rounded-full shadow hover:bg-gray-200 transition">
                View Profile
              </button>
            </Link>
          )}
          {connected && authToken && (
            <button 
              onClick={handleLogout}
              className="px-5 py-2 bg-black border border-white text-white rounded-full shadow hover:bg-white hover:text-black transition"
            >
              Logout
            </button>
          )}
          <WalletDisconnectButton />
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
        <h2 className="text-6xl font-black mb-6 leading-tight tracking-tight">Welcome to Solana</h2>
        <p className="text-xl max-w-2xl mb-10 text-gray-300">
          Join a vibrant community of Solana developers and enthusiasts. Share your projects, learn from experts, and collaborate on the future of Web3.
        </p>
        {!connected && (
          <p className="text-lg text-gray-400">Connect your wallet to get started!</p>
        )}
        {connected && !authToken && (
          <button 
            onClick={authenticateWithSolanaAndJWT} 
            className="mt-8 px-10 py-4 bg-white text-black text-xl font-bold rounded-full shadow-lg hover:bg-gray-200 transition"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Authenticate & Join'}
          </button>
        )}
        {authError && <p className="text-red-400 mt-4 text-lg">Error: {authError}</p>}
        {authToken && currentUser && (
          <div className="mt-8 text-center bg-white bg-opacity-5 p-8 rounded-xl shadow-xl max-w-md w-full border border-white/10">
            <p className="text-xl mb-2">Welcome back, <strong className="text-white">{currentUser.username || `User ${currentUser.public_key?.substring(0, 6)}`}</strong>!</p>
            <p className="text-md text-gray-400 break-all">Your Public Key: {currentUser.public_key}</p>
            <p className="text-md text-gray-500 mt-2">Authenticated with Custom JWT.</p>
          </div>
        )}
        {connected && authToken && (
          <div className="mt-12 w-full max-w-3xl">
            <h2 className="text-4xl font-bold mb-8">Explore the Community</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white bg-opacity-5 p-6 rounded-lg shadow-lg hover:shadow-xl border border-white/10 transition">
                <h3 className="text-2xl font-semibold mb-3">My Profile</h3>
                <p className="text-gray-300 mb-4">View and manage your personal details, badges, and contributions.</p>
                <Link href="/profile" passHref>
                  <button className="px-6 py-2 bg-black border border-white text-white rounded-full hover:bg-white hover:text-black transition">Go to Profile</button>
                </Link>
              </div>
              <div className="bg-white bg-opacity-5 p-6 rounded-lg shadow-lg hover:shadow-xl border border-white/10 transition">
                <h3 className="text-2xl font-semibold mb-3">Communities</h3>
                <p className="text-gray-300 mb-4">Discover and join various learning and activity communities on Solana.</p>
                <Link href="/communities" passHref>
                  <button className="px-6 py-2 bg-black border border-white text-white rounded-full hover:bg-white hover:text-black transition">Browse Communities</button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="w-full px-8 py-6 text-center text-gray-500 text-sm border-t border-white/10">
        &copy; {new Date().getFullYear()} Solana Community. All rights reserved.
      </footer>
    </div>
  );
}
