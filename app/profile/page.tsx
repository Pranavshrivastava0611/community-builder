"use client"

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
// @ts-ignore
import jwt from 'jsonwebtoken'; // Temporarily ignore type error due to npm issue

interface UserProfile {
  id: string;
  public_key: string;
  username: string;
  bio?: string;
  avatar_url?: string;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');

      if (!token) {
        router.push('/'); // Redirect to home if not authenticated
        return;
      }

      try {
        // Note: For full security, token verification should always happen on the server.
        const decodedToken: any = jwt.decode(token);
        if (!decodedToken || !decodedToken.id) {
          localStorage.removeItem('authToken');
          router.push('/');
          return;
        }

        const response = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch profile');
        }

        const data = await response.json();
        setUserProfile(data.profile);

      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err.message || 'An error occurred while loading profile.');
        localStorage.removeItem('authToken');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-xl text-gray-500">Loading profile...</p></div>;
  }
  if (error) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-xl text-red-500">Error: {error}</p></div>;
  }

  if (!userProfile) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-xl text-gray-500">No profile data found.</p></div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-sans relative overflow-hidden selection:bg-orange-500/30">

      {/* Background Visuals */}
      <div
        className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none"
        style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)' }}
      ></div>
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none opacity-40"></div>

      {/* Header */}
      <header className="w-full px-8 py-6 flex justify-between items-center border-b border-white/5 bg-black/30 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
          My <span className="text-orange-500">Profile</span>
        </h1>
        <Link href="/">
          <button className="px-5 py-2 text-sm bg-white/5 border border-white/10 text-white font-medium rounded-full hover:bg-white/10 hover:border-orange-500/30 transition-all duration-300">
            Back to Home
          </button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center relative z-10 animate-fade-in-up">
        <div className="bg-white/5 backdrop-blur-md p-10 rounded-2xl shadow-2xl border border-white/10 hover:border-orange-500/20 transition-all duration-500 max-w-2xl w-full relative overflow-hidden group">

          {/* Decorative gradients inside card */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-transparent opacity-50"></div>

          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl font-bold text-white shadow-lg ring-4 ring-black/50">
            {userProfile.username?.[0]?.toUpperCase() || 'U'}
          </div>

          <h2 className="text-4xl font-black mb-2 tracking-tight text-white">
            {userProfile.username || 'Anonymous User'}
          </h2>
          <p className="text-sm font-mono text-orange-400 mb-8 bg-orange-500/10 py-1 px-3 rounded-full inline-block border border-orange-500/20">
            {userProfile.public_key || "No Key"}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-8">
            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2 font-semibold">About</p>
              <p className="text-md text-gray-300 leading-relaxed">
                Passionate about Solana and Web3. Always learning, building, and sharing.
              </p>
            </div>
            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2 font-semibold">Achievements</p>
              <div className="flex flex-wrap gap-2">
                {['Early Adopter', 'Builder', 'OG'].map(badge => (
                  <span key={badge} className="px-3 py-1 bg-gradient-to-r from-gray-800 to-gray-900 border border-white/10 text-white rounded-lg text-xs font-medium shadow-sm hover:border-orange-500/50 transition-colors cursor-default">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Link href="/">
            <button className="w-full py-4 rounded-xl bg-white text-black font-bold text-lg hover:bg-gray-200 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,165,0,0.4)] relative overflow-hidden group/btn">
              <span className="relative z-10">Return to Dashboard</span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-200 to-white opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 mix-blend-overlay"></div>
            </button>
          </Link>
        </div>
      </main>

      <footer className="w-full px-8 py-6 text-center text-gray-600 text-xs border-t border-white/5 relative z-10 bg-black/20">
        &copy; {new Date().getFullYear()} Solana Community. All rights reserved.
      </footer>
    </div>
  );
}
