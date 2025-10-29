"use client"

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
    <div className="min-h-screen p-8 bg-linear-to-br from-blue-900 to-indigo-900 text-white font-sans">
      <div className="max-w-3xl mx-auto bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg p-10 rounded-2xl shadow-2xl border border-white border-opacity-20">
        <h1 className="text-5xl font-extrabold mb-8 text-center leading-tight">My Profile</h1>

        <div className="flex flex-col items-center mb-8">
          {userProfile.avatar_url ? (
            <img src={userProfile.avatar_url} alt="Avatar" className="w-32 h-32 rounded-full object-cover border-4 border-purple-500 shadow-lg" />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center text-5xl font-bold text-gray-300 border-4 border-purple-500 shadow-lg">
              {userProfile.username ? userProfile.username.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <h2 className="text-3xl font-bold mt-4">{userProfile.username}</h2>
          <p className="font-mono text-sm opacity-70 break-all">{userProfile.public_key}</p>
        </div>

        {userProfile.bio && (
          <div className="mb-8 p-6 bg-white bg-opacity-5 rounded-lg shadow-inner">
            <h3 className="text-2xl font-semibold mb-3">About Me</h3>
            <p className="text-lg opacity-90 leading-relaxed">{userProfile.bio}</p>
          </div>
        )}

        {/* Placeholder for future sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white bg-opacity-5 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">Badges Earned</h3>
            <p className="opacity-70">No badges yet. Keep engaging!</p>
            {/* Dynamically render badges here */}
          </div>
          <div className="bg-white bg-opacity-5 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">Community Contributions</h3>
            <p className="opacity-70">Start contributing to communities!</p>
            {/* Dynamically render contributions here */}
          </div>
        </div>

        <div className="text-center mt-12">
          <button 
            onClick={() => router.push('/')}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-lg shadow-lg transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          >
            Back to Home
          </button>
        </div>

      </div>
    </div>
  );
}
