"use client";

import FeedPost from "@/components/FeedPost";
import Navbar from "@/components/Navbar";
import { Disc, Grid, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster, toast } from 'react-hot-toast';

interface UserProfile {
  id: string;
  public_key: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  interests?: string[];
  karma?: number;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "stats" | "settings" | "recordings">("posts");
  const [liveStream, setLiveStream] = useState<any | null>(null);

  // Data States
  const [posts, setPosts] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);

  const router = useRouter();

  useEffect(() => {
    async function fetchAuthProfile() {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/');
        return;
      }

      try {
        const response = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch profile');
        const data = await response.json();
        const profile = data.profile;
        setUserProfile(profile);

        // Fetch Stats
        const [statsRes, postsRes, friendsRes] = await Promise.allSettled([
          fetch(`/api/profile/stats?userId=${profile.id}&stat=posts`).then(r => r.json()),
          fetch(`/api/feed/user?userId=${profile.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()),
          fetch(`/api/profile/stats?userId=${profile.id}&stat=friends`).then(r => r.json())
        ]);

        if (statsRes.status === 'fulfilled') setPostCount(statsRes.value.count || 0);
        if (postsRes.status === 'fulfilled') setPosts(postsRes.value.posts || []);
        if (friendsRes.status === 'fulfilled') setFriendCount(friendsRes.value.count || 0);

        // Fetch Recordings
        fetch(`/api/streams/recordings?streamerId=${profile.username}`)
          .then(r => r.json())
          .then(data => setRecordings(data.recordings || []));

        // Check Live Status
        fetch(`/api/streams/status?streamerId=${profile.username}`)
          .then(r => r.json())
          .then(data => setLiveStream(data.stream));

      } catch (err: any) {
        toast.error("Session expired or sync failed");
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchAuthProfile();
  }, [router]);

  const handleLikeToggle = (postId: string, newLiked: boolean) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isLiked: newLiked,
          like_count: newLiked ? p.like_count + 1 : Math.max(0, p.like_count - 1)
        };
      }
      return p;
    }));
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    toast.success("Identity Disconnected");
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!userProfile) return null;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
      <Toaster position="bottom-right" />
      <Navbar />

      <main className="max-w-4xl mx-auto pt-24 md:pt-32 px-4 pb-20">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-16 mb-16">
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[3px] bg-gradient-to-tr from-orange-400 to-rose-600 shadow-2xl shadow-orange-500/20">
              <div className="w-full h-full rounded-full bg-black border-[4px] border-black overflow-hidden">
                <img
                  src={userProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.public_key}`}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
            </div>
            {liveStream && (
              <Link href={`/communities/${liveStream.community_id}`}>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-bounce shadow-xl border border-red-400/50 cursor-pointer">
                  Live Now
                </div>
              </Link>
            )}
          </div>

          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <h1 className="text-3xl font-black uppercase tracking-tighter">{userProfile.username}</h1>
              <div className="flex gap-2">
                <Link href="/profile/edit">
                  <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                    Edit Identity
                  </button>
                </Link>
                <button onClick={logout} className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500/20 transition-all">
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-12">
              <div>
                <span className="text-2xl font-black block">{postCount}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Posts</span>
              </div>
              <div>
                <span className="text-2xl font-black block">{friendCount}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Friends</span>
              </div>
              <div>
                <span className="text-2xl font-black block text-orange-500">{userProfile.karma || 0}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Karma</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-300 leading-relaxed max-w-lg">
                {userProfile.bio || "No description set."}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {userProfile.interests?.map(interest => (
                  <span key={interest} className="text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded-md text-gray-500">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-center border-t border-white/10">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex items-center gap-2 py-4 px-8 border-t-2 transition-all ${activeTab === 'posts' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-white'}`}
          >
            <Grid size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Post History</span>
          </button>
          <button
            onClick={() => setActiveTab("recordings")}
            className={`flex items-center gap-2 py-4 px-8 border-t-2 transition-all ${activeTab === 'recordings' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-white'}`}
          >
            <Disc size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Broadcast Vault</span>
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 py-4 px-8 border-t-2 transition-all ${activeTab === 'stats' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-white'}`}
          >
            <Settings size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Identity Config</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === "posts" && (
            <div className="space-y-12 max-w-2xl mx-auto">
              {posts.length === 0 ? (
                <div className="py-20 text-center bg-white/[0.02] rounded-[40px] border border-dashed border-white/5">
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">No neural broadcasts recorded.</p>
                </div>
              ) : (
                posts.map(post => (
                  <FeedPost key={post.id} post={post} onLikeToggle={handleLikeToggle} />
                ))
              )}
            </div>
          )}

          {activeTab === "recordings" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {recordings.length === 0 ? (
                <div className="col-span-full py-32 text-center bg-white/[0.02] rounded-[60px] border border-dashed border-white/5 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-6">
                    <Disc className="w-10 h-10 text-orange-500/50" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-widest text-white/40 mb-2">Vault Sealed</h3>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] max-w-xs leading-loose">No archived neural broadcasts found in this sector. Start a stream to begin logging transmissions.</p>
                </div>
              ) : (
                recordings.map(rec => (
                  <div key={rec.id} className="relative bg-neutral-950 border border-white/5 rounded-[40px] overflow-hidden group hover:border-orange-500/30 transition-all duration-500 shadow-2xl hover:-translate-y-2">
                    <div className="aspect-video bg-black relative overflow-hidden">
                      <video
                        src={rec.video_url}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        poster="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60" />

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                          <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-2" />
                        </div>
                      </div>

                      <div className="absolute top-6 right-6">
                        <div className="bg-orange-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl">Archive</div>
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-white font-black uppercase tracking-widest text-sm truncate pr-4">{rec.title}</h4>
                        <a
                          href={rec.video_url}
                          download={`${rec.title}.webm`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-orange-500 hover:text-white transition-all text-gray-400"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                            <Users size={12} className="text-gray-500" />
                          </div>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{rec.room_name.split('-')[0]}</span>
                        </div>
                        <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">{new Date(rec.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-orange-500">Wallet Link</h3>
                <p className="text-[10px] font-mono text-gray-400 break-all bg-black/40 p-3 rounded-xl border border-white/5">
                  {userProfile.public_key}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-rose-500">Encryption</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Neural identity secured via Phantom Protocol.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
