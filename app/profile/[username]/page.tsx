"use client";

import FriendButton from "@/components/FriendButton";
import GlassPanel from "@/components/GlassPanel";
import Navbar from "@/components/Navbar";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Profile {
    id: string;
    username: string;
    bio?: string;
    avatar_url?: string;
    public_key: string;
}

export default function UserProfilePage() {
    const params = useParams() as any;
    const username = params.username;
    const [profile, setProfile] = useState<Profile | null>(null);
    const [mutualInfo, setMutualInfo] = useState<{ mutualFriends: any[], totalCount: number }>({ mutualFriends: [], totalCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch(`/api/profile?username=${username}`);
                const data = await res.json();
                if (data.profile) {
                    setProfile(data.profile);

                    // Fetch mutual friends if logged in
                    const token = localStorage.getItem("authToken");
                    if (token) {
                        const mRes = await fetch(`/api/friends/mutual/${data.profile.id}`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        const mData = await mRes.json();
                        setMutualInfo(mData);
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

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase italic">Loading Identity...</div>;
    if (!profile) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">User Not Found</div>;

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
            <Navbar />

            <main className="max-w-4xl mx-auto pt-20 px-4">
                <GlassPanel className="p-10 relative overflow-hidden group">
                    {/* Background Decorative Blur */}
                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-orange-600/20 rounded-full blur-[120px] group-hover:bg-orange-600/30 transition-all duration-700" />

                    <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                        <div className="relative">
                            <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-orange-400 via-rose-500 to-purple-600 p-[3px] shadow-2xl shadow-orange-500/20">
                                <div className="w-full h-full rounded-full bg-black border-4 border-black overflow-hidden relative">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.username} />
                                    ) : (
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} className="w-full h-full object-cover" alt="" />
                                    )}
                                </div>
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-black" title="Online" />
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                                <h1 className="text-5xl font-black uppercase tracking-tighter leading-none">{profile.username}</h1>
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
                        <div>
                            <p className="text-2xl font-black italic">1.2k</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Reputation</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black italic">42</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Posts</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black italic">156</p>
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
