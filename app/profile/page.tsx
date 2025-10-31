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
    <div className="min-h-screen flex flex-col bg-black text-white font-sans">
      <header className="w-full px-8 py-6 flex justify-between items-center border-b border-white/10 shadow-lg">
        <h1 className="text-3xl font-extrabold tracking-tight">My Profile</h1>
        <Link href="/">
          <button className="px-5 py-2 bg-white text-black font-semibold rounded-full shadow hover:bg-gray-200 transition">
            Home
          </button>
        </Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="bg-white bg-opacity-5 p-10 rounded-2xl shadow-2xl border border-white/10 max-w-lg w-full">
          <h2 className="text-4xl font-bold mb-6">Welcome, <span className="text-white">{userProfile.username || `User ${userProfile.public_key?.substring(0, 6)}`}</span></h2>
          <div className="mb-6">
            <p className="text-lg text-gray-300">Public Key:</p>
            <p className="text-md text-gray-400 break-all font-mono">{userProfile.public_key || "Not available"}</p>
          </div>
          <div className="mb-6">
            <p className="text-lg text-gray-300">Badges & Contributions:</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <span className="px-4 py-1 bg-black border border-white text-white rounded-full text-sm shadow">Early Adopter</span>
              <span className="px-4 py-1 bg-black border border-white text-white rounded-full text-sm shadow">Builder</span>
              <span className="px-4 py-1 bg-black border border-white text-white rounded-full text-sm shadow">Community Member</span>
            </div>
          </div>
          <div className="mb-6">
            <p className="text-lg text-gray-300">About Me:</p>
            <p className="text-md text-gray-400">Passionate about Solana and Web3. Always learning, building, and sharing.</p>
          </div>
          <Link href="/">
            <button className="mt-6 px-6 py-2 bg-white text-black font-semibold rounded-full shadow hover:bg-gray-200 transition">
              Back to Home
            </button>
          </Link>
        </div>
      </main>
      <footer className="w-full px-8 py-6 text-center text-gray-500 text-sm border-t border-white/10">
        &copy; {new Date().getFullYear()} Solana Community. All rights reserved.
      </footer>
    </div>
  );
}
