"use client";

import FriendButton from "@/components/FriendButton";
import GlassPanel from "@/components/GlassPanel";
import Navbar from "@/components/Navbar";
import { supabase } from "@/utils/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
    const [mutualInfo, setMutualInfo] = useState<{ mutualFriends: any[], totalCount: number }>({ mutualFriends: [], totalCount: 0 });
    const [loading, setLoading] = useState(true);
    const [karmaIncrement, setKarmaIncrement] = useState<number | null>(null);
    const [postCount, setPostCount] = useState(0);
    const [friendCount, setFriendCount] = useState(0);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch(`/api/profile?username=${username}`);
                const data = await res.json();
                if (data.profile) {
                    setProfile(data.profile);

                    // Batch fetch all stats in parallel for better performance
                    const token = localStorage.getItem("authToken");
                    const profileId = data.profile.id;

                    const [mutualRes, postsRes, friendsRes] = await Promise.allSettled([
                        // Mutual friends
                        token ? fetch(`/api/friends/mutual/${profileId}`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        }).then(r => r.json()) : Promise.resolve({ mutualFriends: [], totalCount: 0 }),

                        // Post count
                        fetch(`/api/profile/stats?userId=${profileId}&stat=posts`).then(r => r.json()),

                        // Friend count
                        fetch(`/api/profile/stats?userId=${profileId}&stat=friends`).then(r => r.json())
                    ]);

                    if (mutualRes.status === 'fulfilled') {
                        setMutualInfo(mutualRes.value);
                    }

                    if (postsRes.status === 'fulfilled' && postsRes.value.count !== undefined) {
                        setPostCount(postsRes.value.count);
                    }

                    if (friendsRes.status === 'fulfilled' && friendsRes.value.count !== undefined) {
                        setFriendCount(friendsRes.value.count);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [username]);

    // Real-time karma subscription
    useEffect(() => {
        if (!profile?.id) return;

        const channel = supabase
            .channel(`profile-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${profile.id}`
                },
                (payload: any) => {
                    const newKarma = payload.new.karma;
                    const oldKarma = profile.karma || 0;

                    if (newKarma !== oldKarma) {
                        const diff = newKarma - oldKarma;
                        setKarmaIncrement(diff);
                        setTimeout(() => setKarmaIncrement(null), 2000);

                        setProfile(prev => prev ? { ...prev, karma: newKarma } : null);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id]);

    // Real-time post count subscription
    useEffect(() => {
        if (!profile?.id) return;

        const postsChannel = supabase
            .channel(`posts-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'posts',
                    filter: `author_id=eq.${profile.id}`
                },
                async () => {
                    // Refetch post count
                    const res = await fetch(`/api/profile/stats?userId=${profile.id}&stat=posts`);
                    const data = await res.json();
                    if (data.count !== undefined) setPostCount(data.count);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(postsChannel);
        };
    }, [profile?.id]);

    // Real-time friend count subscription
    useEffect(() => {
        if (!profile?.id) return;

        const friendshipsChannel = supabase
            .channel(`friendships-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `user1_id=eq.${profile.id}`
                },
                async () => {
                    // Refetch friend count
                    const res = await fetch(`/api/profile/stats?userId=${profile.id}&stat=friends`);
                    const data = await res.json();
                    if (data.count !== undefined) setFriendCount(data.count);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `user2_id=eq.${profile.id}`
                },
                async () => {
                    // Refetch friend count
                    const res = await fetch(`/api/profile/stats?userId=${profile.id}&stat=friends`);
                    const data = await res.json();
                    if (data.count !== undefined) setFriendCount(data.count);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(friendshipsChannel);
        };
    }, [profile?.id]);

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase italic">Loading Identity...</div>;
    if (!profile) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">User Not Found</div>;

    const isKarmaKing = (profile.karma || 0) >= 1000;

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
            <style jsx global>{`
                @keyframes rainbow-border {
                    0% { transform: rotate(0deg); filter: hue-rotate(0deg); }
                    100% { transform: rotate(360deg); filter: hue-rotate(360deg); }
                }
                .rainbow-glow {
                    position: relative;
                }
                .rainbow-glow::before {
                    content: '';
                    position: absolute;
                    inset: -4px;
                    background: conic-gradient(from 0deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
                    border-radius: 50%;
                    z-index: -1;
                    animation: rainbow-border 3s linear infinite;
                    filter: blur(8px);
                }
            `}</style>
            <Navbar />

            <main className="max-w-4xl mx-auto pt-20 px-4">
                <GlassPanel className="p-10 relative overflow-hidden group">
                    {/* Background Decorative Blur */}
                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-orange-600/20 rounded-full blur-[120px] group-hover:bg-orange-600/30 transition-all duration-700" />

                    <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                        <div className="relative">
                            <div className={`w-40 h-40 rounded-full p-[3px] shadow-2xl transition-all duration-500 ${isKarmaKing ? 'rainbow-glow scale-110 shadow-orange-500/40' : 'bg-gradient-to-tr from-orange-400 via-rose-500 to-purple-600 shadow-orange-500/20'}`}>
                                <div className="w-full h-full rounded-full bg-black border-4 border-black overflow-hidden relative">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.username} />
                                    ) : (
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} className="w-full h-full object-cover" alt="" />
                                    )}
                                </div>
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-black" title="Online" />
                            {isKarmaKing && (
                                <div className="absolute -top-4 -left-4 bg-black border border-orange-500 text-orange-500 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter animate-bounce">
                                    Karma King
                                </div>
                            )}
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                                <h1 className={`text-5xl font-black uppercase tracking-tighter leading-none ${isKarmaKing ? 'bg-gradient-to-r from-orange-400 via-rose-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x' : ''}`}>
                                    {profile.username}
                                </h1>
                                <FriendButton targetUserId={profile.id} />
                            </div>

                            <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    {profile.public_key.slice(0, 4)}...{profile.public_key.slice(-4)}
                                </span>
                                <span className="w-1 h-1 bg-gray-700 rounded-full" />
                                <span className="text-xs font-bold text-orange-500 uppercase tracking-tighter italic">Solana Identity Verified</span>
                            </div>

                            <p className="text-lg text-gray-400 font-medium leading-relaxed max-w-xl italic mb-6">
                                "{profile.bio || "This user prefers to keep their bio an enigma."}"
                            </p>

                            {mutualInfo.totalCount > 0 && (
                                <div className="flex items-center gap-3">
                                    <div className="flex -space-x-2">
                                        {mutualInfo.mutualFriends.map((mf, i) => (
                                            <div key={mf.id} className="w-8 h-8 rounded-full border-2 border-black overflow-hidden bg-neutral-900 shadow-xl">
                                                <img src={mf.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mf.username}`} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        {mutualInfo.totalCount} Mutual {mutualInfo.totalCount === 1 ? 'Friend' : 'Friends'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex gap-10 mt-12 pt-10 border-t border-white/5 relative z-10">
                        <div className="relative">
                            <p className={`text-2xl font-black italic ${isKarmaKing ? 'text-orange-400' : ''}`}>{profile.karma || 0}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Reputation</p>

                            <AnimatePresence>
                                {karmaIncrement !== null && (
                                    <motion.div
                                        initial={{ opacity: 1, y: 0 }}
                                        animate={{ opacity: 0, y: -30 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 2 }}
                                        className="absolute -top-8 left-0 text-green-400 font-black text-xl"
                                    >
                                        +{karmaIncrement}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div>
                            <p className="text-2xl font-black italic">{postCount}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Posts</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black italic">{friendCount}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Friends</p>
                        </div>
                    </div>
                </GlassPanel>

                <section className="mt-12">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-600 mb-6 px-2">Recent Contributions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-30 hover:opacity-100 transition-opacity">
                        {[1, 2, 3, 4].map(i => (
                            <GlassPanel key={i} className="p-6 border-dashed border-white/10">
                                <div className="h-4 w-3/4 bg-white/5 rounded-full mb-3" />
                                <div className="h-4 w-1/2 bg-white/5 rounded-full" />
                            </GlassPanel>
                        ))}
                    </div>
                    <div className="text-center py-20">
                        <p className="text-gray-600 font-bold italic tracking-tight">Post feed coming soon...</p>
                    </div>
                </section>
            </main>
        </div>
    );
}
