"use client"

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { signInWithSolana } from '../services/auth';
// @ts-ignore
import jwt from 'jsonwebtoken'; // Temporarily ignore type error for client-side decode

export default function Home() {
  const { publicKey, connected, signMessage, wallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

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
          console.error('Failed to decode stored token');
          localStorage.removeItem('authToken');
          setAuthToken(null);
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error decoding stored token:', error);
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setCurrentUser(null);
      }
    }
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
    if (connected && publicKey && wallet && signMessage && !authToken && !loading) {
      authenticateWithSolanaAndJWT();
    }
  }, [connected, publicKey, wallet, signMessage, authToken, loading, authenticateWithSolanaAndJWT]);

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('authToken');
    // disconnect(); 
  };

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-blue-900 to-indigo-900 text-white font-sans">
      <header className="w-full p-6 flex justify-between items-center bg-gray-800 bg-opacity-50 shadow-md">
        <h2 className="text-2xl font-bold text-white">Solana Community</h2>
        <div className="flex items-center gap-4">
          <WalletMultiButton /> 
          {connected && authToken && (
            <Link href="/profile" passHref>
              <button
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
              >
                View Profile
              </button>
            </Link>
          )}
          {connected && authToken && (
            <button 
              onClick={handleLogout}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
            >
              Logout
            </button>
          )}
          <WalletDisconnectButton />
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-6xl font-extrabold mb-6 leading-tight">
          Build, Learn, Grow on Solana
        </h1>
        <p className="text-xl max-w-2xl mb-10 opacity-80">
          Join a vibrant community of Solana developers and enthusiasts. Share your projects, learn from experts, and collaborate on the future of Web3.
        </p>

        {!connected && (
          <p className="text-lg opacity-90">Connect your wallet to get started!</p>
        )}

        {connected && !authToken && (
          <button 
            onClick={authenticateWithSolanaAndJWT} 
            className="mt-8 px-10 py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-full shadow-lg transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-400 focus:ring-opacity-75"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Authenticate with Solana & Join'}
          </button>
        )}
        {authError && <p className="text-red-400 mt-4 text-lg">Error: {authError}</p>}
        {authToken && currentUser && (
          <div className="mt-8 text-center bg-white bg-opacity-10 p-8 rounded-xl shadow-xl max-w-md w-full">
            <p className="text-xl mb-2">Welcome back, <strong className="text-green-300">{currentUser.username || `User ${currentUser.publicKey?.substring(0, 6)}`}</strong>!</p>
            <p className="text-md opacity-80 break-all">Your Public Key: {currentUser.publicKey}</p>
            <p className="text-md opacity-70 mt-2">Authenticated with Custom JWT.</p>
          </div>
        )}

        {connected && authToken && (
          <div className="mt-12 w-full max-w-3xl">
            <h2 className="text-4xl font-bold mb-8">Explore the Community</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white bg-opacity-10 p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
                <h3 className="text-2xl font-semibold mb-3">My Profile</h3>
                <p className="opacity-80 mb-4">View and manage your personal details, badges, and contributions.</p>
                <Link href="/profile" passHref>
                  <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition duration-300">Go to Profile</button>
                </Link>
              </div>
              <div className="bg-white bg-opacity-10 p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
                <h3 className="text-2xl font-semibold mb-3">Communities</h3>
                <p className="opacity-80 mb-4">Discover and join various learning and activity communities on Solana.</p>
                <Link href="/communities" passHref>
                  <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition duration-300">Browse Communities</button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="w-full p-6 text-center text-gray-400 text-sm bg-gray-800 bg-opacity-50 mt-12">
        &copy; {new Date().getFullYear()} Solana Community. All rights reserved.
      </footer>
    </div>
  );
}
