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
    <div className="min-h-screen flex flex-col bg-black text-white font-sans relative overflow-hidden selection:bg-orange-500/30">

      {/* Background Visuals */}
      <div
        className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none"
        style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)' }}
      ></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none opacity-40"></div>

      {/* Header */}
      <header className="w-full px-8 py-6 flex justify-between items-center border-b border-white/5 bg-black/30 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
          SOLANA<span className="text-orange-500">COMMUNITY</span>
        </h1>
        <div className="flex items-center gap-4">
          <div className="scale-90 opacity-90 hover:opacity-100 transition-opacity">
            <WalletMultiButton />
          </div>
          {connected && authToken && (
            <Link href="/profile" passHref>
              <button className="px-5 py-2 text-sm bg-white/5 border border-white/10 text-white font-medium rounded-full hover:bg-white/10 hover:border-orange-500/30 transition-all duration-300">
                Profile
              </button>
            </Link>
          )}
          {connected && authToken && (
            <button
              onClick={handleLogout}
              className="px-5 py-2 text-sm bg-transparent border border-white/10 text-gray-400 rounded-full hover:text-white hover:border-white/30 transition-all duration-300"
            >
              Logout
            </button>
          )}
          <div className="scale-90 opacity-70 hover:opacity-100 transition-opacity">
            <WalletDisconnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center relative z-10">

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto flex flex-col items-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-orange-400 tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            Live on Mainnet
          </div>

          <h2 className="text-6xl md:text-8xl font-black mb-6 leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-500">
            BUILD THE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-200">FUTURE</span>
          </h2>

          <p className="text-lg md:text-xl max-w-2xl mb-12 text-gray-400 leading-relaxed font-light">
            Join the fastest growing ecosystem of developers and creators. <br className="hidden md:block" /> Connect, collaborate, and launch your next big idea on Solana.
          </p>

          {!connected && (
            <p className="text-sm text-gray-500 font-mono mb-8 animate-pulse">Connect wallet to initialize session_</p>
          )}

          {connected && !authToken && (
            <button
              onClick={authenticateWithSolanaAndJWT}
              className="group relative px-8 py-4 bg-white text-black text-lg font-bold rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
              disabled={loading}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </span>
              ) : (
                'Authenticate & Enter'
              )}
            </button>
          )}

          {authError && (
            <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              Error: {authError}
            </div>
          )}

          {authToken && currentUser && (
            <div className="mt-10 animate-fade-in bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 w-full max-w-md mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                {currentUser.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <p className="text-2xl font-bold text-white mb-1">
                {currentUser.username || 'Anonymous User'}
              </p>
              <p className="text-xs text-gray-500 font-mono bg-black/30 py-1 px-3 rounded-full inline-block mb-4 border border-white/5">
                {currentUser.public_key?.substring(0, 4)}...{currentUser.public_key?.substring(currentUser.public_key?.length - 4)}
              </p>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-4"></div>
              <p className="text-sm text-green-400 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Session Active via JWT
              </p>
            </div>
          )}
        </div>

        {/* Explore Section */}
        {connected && authToken && (
          <div className="mt-20 w-full max-w-5xl animate-fade-in-up delay-100">
            <h2 className="text-3xl font-bold mb-10 text-left pl-2 border-l-4 border-orange-500">Explore Ecosystem</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: 'My Profile',
                  desc: 'Manage your decentralized identity, view badges, and track your contribution history.',
                  link: '/profile',
                  btn: 'View Profile',
                  icon: (
                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )
                },
                {
                  title: 'Communities',
                  desc: 'Join exclusive developer circles, participate in hackathons, and find your squad.',
                  link: '/communities',
                  btn: 'Browse Communities',
                  icon: (
                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  )
                }
              ].map((item, idx) => (
                <div key={idx} className="group bg-white/5 backdrop-blur-md p-8 rounded-xl border border-white/5 hover:border-orange-500/30 transition-all duration-300 hover:bg-white/[0.07] text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                    {/* Abstract shape */}
                    <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-purple-500 rounded-full blur-2xl"></div>
                  </div>

                  <div className="mb-6 p-3 bg-black/40 w-fit rounded-lg border border-white/5 group-hover:border-orange-500/30 transition-colors">
                    {item.icon}
                  </div>

                  <h3 className="text-2xl font-bold mb-3 text-white group-hover:text-orange-400 transition-colors">{item.title}</h3>
                  <p className="text-gray-400 mb-8 leading-relaxed h-12">{item.desc}</p>

                  <Link href={item.link} passHref>
                    <button className="flex items-center gap-2 text-sm font-bold text-white group-hover:gap-3 transition-all duration-300">
                      {item.btn}
                      <span className="text-orange-500">&rarr;</span>
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="w-full px-8 py-8 text-center text-gray-600 text-xs border-t border-white/5 relative z-10 bg-black/20">
        <div className="flex justify-center gap-6 mb-4">
          {['Twitter', 'Discord', 'Github'].map((social) => (
            <a key={social} href="#" className="hover:text-orange-500 transition-colors">{social}</a>
          ))}
        </div>
        &copy; {new Date().getFullYear()} Solana Community. Deployed on Solana.
      </footer>
    </div>
  );
}
