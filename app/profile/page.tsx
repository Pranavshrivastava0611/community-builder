"use client"

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
// @ts-ignore

interface UserProfile {
  id: string;
  public_key: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  interests?: string[];
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit States
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editInterests, setEditInterests] = useState<string[]>([]);

  const INTEREST_OPTIONS = ["DeFi", "NFTs", "Gaming", "DAOs", "Trading", "Development", "Art", "Memes", "Music", "Social"];

  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');

      if (!token) {
        router.push('/');
        return;
      }

      try {
        const response = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch profile');
        }

        const data = await response.json();
        const profile = data.profile;
        setUserProfile(profile);
        setEditUsername(profile.username || "");
        setEditBio(profile.bio || "");
        setEditAvatar(profile.avatar_url || "");
        setEditInterests(profile.interests || []);

      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err.message || 'An error occurred while loading profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: editUsername,
          bio: editBio,
          avatar_url: editAvatar,
          interests: editInterests
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
        setIsEditing(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update profile");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  const randomizeAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    setEditAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`);
  };

  if (loading) {
    return <div className="flex min-h-screen bg-black items-center justify-center animate-pulse text-orange-400 font-black italic text-2xl tracking-tighter">LOADING IDENTITY...</div>;
  }

  if (!userProfile) {
    return <div className="flex min-h-screen bg-black items-center justify-center text-white">No Profile Found</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-sans relative overflow-x-hidden selection:bg-orange-500/30">
      <div className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none opacity-20"></div>

      <header className="w-full px-8 py-6 flex justify-between items-center border-b border-white/5 bg-black/30 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-2xl font-black tracking-tighter text-white">
          MY<span className="text-orange-500">PROFILE</span>
        </h1>
        <Link href="/feed">
          <button className="px-6 py-2 text-xs font-black bg-white/5 border border-white/10 text-white uppercase tracking-widest rounded-full hover:bg-white/10 transition-all">
            Back to Feed
          </button>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center py-12 px-4 relative z-10">
        <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-rose-500 to-rose-600"></div>

          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative group/avatar">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-orange-400 to-rose-600 p-[3px] shadow-2xl shadow-orange-500/20 mb-6">
                <div className="w-full h-full rounded-full bg-black border-4 border-black overflow-hidden relative">
                  {(isEditing ? editAvatar : userProfile.avatar_url) ? (
                    <img src={isEditing ? editAvatar : userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.public_key}`}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  )}
                </div>
              </div>
              {isEditing && (
                <button
                  onClick={randomizeAvatar}
                  className="absolute bottom-6 right-0 bg-white text-black p-2 rounded-full hover:scale-110 transition-transform shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
            </div>

            {isEditing ? (
              <input
                value={editUsername}
                onChange={e => setEditUsername(e.target.value)}
                className="text-4xl font-black text-center bg-transparent border-b-2 border-orange-500/50 outline-none w-full max-w-sm pb-2 placeholder:opacity-30"
                placeholder="Username"
              />
            ) : (
              <h2 className="text-4xl font-black tracking-tight mb-2 uppercase">{userProfile.username}</h2>
            )}

            <p className="text-xs font-mono text-white/40 bg-white/5 px-4 py-1.5 rounded-full border border-white/5 mt-4">
              {userProfile.public_key}
            </p>
          </div>

          {/* Bio Section */}
          <div className="space-y-6 mb-12">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-3 block">Perspective</label>
              {isEditing ? (
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-gray-200 outline-none focus:border-orange-500/50 min-h-[120px] resize-none font-medium leading-relaxed"
                  placeholder="Tell your story..."
                />
              ) : (
                <div className="bg-black/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                  <p className="text-gray-300 text-lg leading-relaxed italic relative z-10">
                    {userProfile.bio || "No bio yet. Tell the community about yourself."}
                  </p>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full"></div>
                </div>
              )}
            </div>

            {/* Interests Section */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-3 block">Interests</label>
              <div className="flex flex-wrap gap-2">
                {(isEditing ? INTEREST_OPTIONS : (userProfile.interests || [])).map(interest => {
                  const isSelected = isEditing ? editInterests.includes(interest) : true;
                  return (
                    <button
                      key={interest}
                      disabled={!isEditing}
                      onClick={() => {
                        if (!isEditing) return;
                        setEditInterests(prev =>
                          prev.includes(interest)
                            ? prev.filter(i => i !== interest)
                            : [...prev, interest]
                        );
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSelected
                          ? "bg-orange-500 text-white border border-orange-400 shadow-lg shadow-orange-500/20"
                          : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                        }`}
                    >
                      {interest}
                    </button>
                  );
                })}
                {!isEditing && (!userProfile.interests || userProfile.interests.length === 0) && (
                  <p className="text-gray-500 text-xs italic">No interests selected yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-4 bg-white text-black font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50"
                >
                  {saving ? "SAVING..." : "CONFIRM UPDATES"}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditUsername(userProfile.username);
                    setEditBio(userProfile.bio || "");
                    setEditAvatar(userProfile.avatar_url || "");
                  }}
                  className="px-8 py-4 bg-white/5 border border-white/10 text-white font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-white/10 transition-all"
                >
                  CANCEL
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-5 bg-gradient-to-r from-orange-400 to-rose-600 text-white font-black uppercase text-sm tracking-[0.2em] rounded-2xl shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                CUSTOMIZE IDENTITY
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full px-8 py-8 text-center border-t border-white/5">
        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">SECURED BY SOLANA & METEORA</p>
      </footer>
    </div>
  );
}
