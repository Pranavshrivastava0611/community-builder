"use client";

import FeedPost from "@/components/FeedPost";
import FriendButton from "@/components/FriendButton";
import GlassPanel from "@/components/GlassPanel";
import Navbar from "@/components/Navbar";
import { AnimatePresence, motion } from "framer-motion";
import { Disc, Grid, Layout, Share2, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";

interface Profile {
    id: string;
    username: string;
    bio?: string;
    avatar_url?: string;
    public_key: string;
    karma?: number;
}

export default function UserProfilePage() {
    const params = useParams() as any;
    const username = params.username;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"posts" | "stats" | "communities" | "recordings">("posts");
    const [liveStream, setLiveStream] = useState<any | null>(null);

    // Stats
    const [posts, setPosts] = useState<any[]>([]);
    const [recordings, setRecordings] = useState<any[]>([]);
    const [postCount, setPostCount] = useState(0);
    const [friendCount, setFriendCount] = useState(0);
    const [mutualInfo, setMutualInfo] = useState<{ mutualFriends: any[], totalCount: number }>({ mutualFriends: [], totalCount: 0 });

    // UI States
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [showMutuals, setShowMutuals] = useState(false);

    useEffect(() => {
        async function fetchProfileData() {
            try {
                const res = await fetch(`/api/profile?username=${username}`);
                const data = await res.json();
                if (data.profile) {
                    setProfile(data.profile);
                    const profileId = data.profile.id;
                    const token = localStorage.getItem("authToken");

                    // Parallel fetch stats & posts
                    const [statsRes, postsRes, friendsRes, mutualRes] = await Promise.allSettled([
                        fetch(`/api/profile/stats?userId=${profileId}&stat=posts`).then(r => r.json()),
                        fetch(`/api/feed/user?userId=${profileId}`).then(r => r.json()),
                        fetch(`/api/profile/stats?userId=${profileId}&stat=friends`).then(r => r.json()),
                        token ? fetch(`/api/friends/mutual/${profileId}`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        }).then(r => r.json()) : Promise.resolve({ mutualFriends: [], totalCount: 0 })
                    ]);

                    if (statsRes.status === 'fulfilled') setPostCount(statsRes.value.count || 0);
                    if (postsRes.status === 'fulfilled') setPosts(postsRes.value.posts || []);
                    if (friendsRes.status === 'fulfilled') setFriendCount(friendsRes.value.count || 0);
                    if (mutualRes.status === 'fulfilled') setMutualInfo(mutualRes.value);

                    // Fetch Recordings
                    fetch(`/api/streams/recordings?streamerId=${username}`)
                        .then(r => r.json())
                        .then(data => setRecordings(data.recordings || []));

                    // Check Live Status
                    fetch(`/api/streams/status?streamerId=${username}`)
                        .then(r => r.json())
                        .then(data => setLiveStream(data.stream));
                }
            } catch (e) {
                console.error("Profile sync failed:", e);
                toast.error("Failed to sync neural profile");
            } finally {
                setLoading(false);
            }
        }
        if (username) fetchProfileData();
    }, [username]);

    const handleShare = async () => {
        const shareData = {
            title: `${profile?.username}'s Neural Identity`,
            text: `Check out ${profile?.username} on Solana Community`,
            url: window.location.href,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                toast.success("Profile link synchronized to clipboard");
            }
        } catch (e) {
            console.error("Sharing failed:", e);
        }
    };

    // Handle Likes on Profile Posts
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

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 border-t-2 border-orange-500 rounded-full animate-spin shadow-[0_0_20px_rgba(234,88,12,0.3)]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-orange-500 animate-pulse">Neural Identity Syncing...</p>
                </div>
            </div>
        );
    }

    if (!profile) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">Identity Not Found</div>;

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30 overflow-x-hidden">
            <Toaster position="bottom-right" />
            <Navbar />

            <main className="max-w-4xl mx-auto pt-24 md:pt-32 px-4 pb-20">
                {/* Instagram Style Header */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-16 mb-16">
                    {/* Avatar with Glow */}
                    <div className="relative group">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[3px] bg-gradient-to-tr from-orange-500 via-rose-500 to-purple-600 shadow-2xl shadow-orange-500/20 group-hover:scale-105 transition-transform duration-500">
                            <div className="w-full h-full rounded-full bg-black border-[4px] border-black overflow-hidden relative">
                                <img
                                    src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
                                    className="w-full h-full object-cover"
                                    alt={profile.username}
                                />
                            </div>
                        </div>
                        {/* Status Ring */}
                        {liveStream ? (
                            <Link href={`/communities/${liveStream.community_id}`}>
                                <div className="absolute -bottom-1 -right-1 bg-red-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border-4 border-black shadow-lg animate-pulse cursor-pointer">Live</div>
                            </Link>
                        ) : (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-black rounded-full shadow-lg" />
                        )}
                    </div>

                    {/* Meta Info */}
                    <div className="flex-1 space-y-6 text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
                                {profile.username}
                            </h1>
                            <div className="flex gap-2">
                                <FriendButton targetUserId={profile.id} />
                                <button
                                    onClick={handleShare}
                                    className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-gray-400 hover:text-white"
                                >
                                    <Share2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Counts Bar */}
                        <div className="flex items-center justify-center md:justify-start gap-8 md:gap-12">
                            <div className="text-center md:text-left">
                                <span className="text-xl md:text-2xl font-black block">{postCount}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Posts</span>
                            </div>
                            <div className="text-center md:text-left cursor-pointer group">
                                <span className="text-xl md:text-2xl font-black block group-hover:text-orange-500 transition-colors">{friendCount}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Links</span>
                            </div>
                            <div className="text-center md:text-left">
                                <span className="text-xl md:text-2xl font-black block text-orange-500">{profile.karma || 0}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Karma</span>
                            </div>
                        </div>

                        {/* Bio & Links */}
                        <div className="space-y-3">
                            <p className="text-sm font-bold text-gray-300 leading-relaxed max-w-lg">
                                {profile.bio || "No description of this neural unit yet."}
                            </p>
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <span className="text-[10px] font-mono text-white/30 truncate max-w-[150px]">
                                    {profile.public_key}
                                </span>
                            </div>
                        </div>

                        {/* Mutual Friends (Reddit style stack) */}
                        {mutualInfo.totalCount > 0 && (
                            <button
                                onClick={() => setShowMutuals(true)}
                                className="flex items-center justify-center md:justify-start gap-3 pt-2 hover:opacity-80 transition-opacity"
                            >
                                <div className="flex -space-x-3">
                                    {mutualInfo.mutualFriends.slice(0, 3).map((mf: any) => (
                                        <div key={mf.id} className="w-8 h-8 rounded-full border-2 border-black overflow-hidden bg-neutral-950 shadow-xl">
                                            <img src={mf.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mf.username}`} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    {mutualInfo.totalCount} Mutual Signals
                                </p>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs Bar */}
                <div className="flex items-center justify-center border-t border-white/10">
                    <button
                        onClick={() => setActiveTab("posts")}
                        className={`flex items-center gap-2 py-4 px-8 border-t-2 transition-all ${activeTab === 'posts' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        <Grid size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Transmission Hub</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("recordings")}
                        className={`flex items-center gap-2 py-4 px-8 border-t-2 transition-all ${activeTab === 'recordings' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        <Disc size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Broadcast Hub</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("stats")}
                        className={`flex items-center gap-2 py-4 px-8 border-t-2 transition-all ${activeTab === 'stats' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        <Layout size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Neural Specs</span>
                    </button>
                </div>

                {/* Content Grid */}
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {activeTab === "posts" && (
                        <div className="grid grid-cols-1 gap-12">
                            {posts.length === 0 ? (
                                <div className="py-20 text-center border border-dashed border-white/5 rounded-[40px] bg-white/[0.02]">
                                    <Layout size={40} className="mx-auto text-gray-700 mb-6" />
                                    <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-xs">No active transmissions detected.</p>
                                </div>
                            ) : (
                                posts.map(post => (
                                    <div key={post.id} className="max-w-2xl mx-auto w-full">
                                        <FeedPost
                                            post={post}
                                            onLikeToggle={handleLikeToggle}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "recordings" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {recordings.length === 0 ? (
                                <div className="col-span-full py-32 text-center border border-dashed border-white/5 rounded-[60px] bg-white/[0.02] flex flex-col items-center justify-center">
                                    <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-6">
                                        <Disc className="w-10 h-10 text-orange-500/50" />
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-widest text-white/40 mb-2">Vault Sealed</h3>
                                    <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">No archived transmissions detected in this node.</p>
                                </div>
                            ) : (
                                recordings.map(rec => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={rec.id}
                                        className="relative bg-neutral-950 border border-white/5 rounded-[40px] overflow-hidden group hover:border-orange-500/30 transition-all duration-500 shadow-2xl hover:-translate-y-2"
                                    >
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
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "stats" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <GlassPanel className="p-8 space-y-4 border-orange-500/20">
                                <h3 className="text-xs font-black uppercase tracking-widest text-orange-500">Identity Karma</h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black">{profile.karma || 0}</span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Points</span>
                                </div>
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500 w-[70%]" />
                                </div>
                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
                                    High Karma indicates a reliable and active community transmitter.
                                </p>
                            </GlassPanel>

                            <GlassPanel className="p-8 space-y-4 border-rose-500/20">
                                <h3 className="text-xs font-black uppercase tracking-widest text-rose-500">Network Reach</h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black">{friendCount}</span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Active Links</span>
                                </div>
                                <div className="flex -space-x-2 pt-2">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-neutral-900 overflow-hidden">
                                            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${i + profile.id}`} alt="" />
                                        </div>
                                    ))}
                                </div>
                            </GlassPanel>
                        </div>
                    )}
                </div>
            </main>

            {/* Mutuals Modal */}
            <AnimatePresence>
                {showMutuals && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMutuals(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-lg font-black uppercase tracking-widest text-white">Mutual Signals</h3>
                                <button
                                    onClick={() => setShowMutuals(false)}
                                    className="p-2 hover:bg-white/5 rounded-xl transition-all"
                                >
                                    <Users size={18} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="p-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                                {mutualInfo.mutualFriends.map(friend => (
                                    <Link
                                        key={friend.id}
                                        href={`/profile/${friend.username}`}
                                        onClick={() => setShowMutuals(false)}
                                        className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-full border-2 border-white/10 overflow-hidden">
                                            <img src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-black text-white group-hover:text-orange-500 transition-colors">{friend.username}</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Active Node</p>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
