"use client"

import Navbar from "@/components/Navbar";
import { Camera, ChevronLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';

interface UserProfile {
    id: string;
    public_key: string;
    username: string;
    bio?: string;
    avatar_url?: string;
    interests?: string[];
}

export default function EditProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Edit States
    const [editUsername, setEditUsername] = useState("");
    const [editBio, setEditBio] = useState("");
    const [editAvatar, setEditAvatar] = useState("");
    const [editInterests, setEditInterests] = useState<string[]>([]);

    const INTEREST_OPTIONS = ["DeFi", "NFTs", "Gaming", "DAOs", "Trading", "Development", "Art", "Memes", "Music", "Social"];
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('authToken');
            if (!token) {
                router.push('/');
                return;
            }

            try {
                const response = await fetch('/api/profile', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    const profile = data.profile;
                    setUserProfile(profile);
                    setEditUsername(profile.username || "");
                    setEditBio(profile.bio || "");
                    setEditAvatar(profile.avatar_url || "");
                    setEditInterests(profile.interests || []);
                }
            } catch (err) {
                console.error(err);
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
                toast.success("Identity Updated");
                router.push('/profile');
            } else {
                const err = await res.json();
                toast.error(err.error || "Update failed");
            }
        } catch (e) {
            toast.error("Error saving profile");
        } finally {
            setSaving(false);
        }
    };

    const randomizeAvatar = () => {
        const newSeed = Math.random().toString(36).substring(7);
        setEditAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`);
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
            <Toaster position="bottom-right" />
            <Navbar />

            <main className="max-w-2xl mx-auto pt-24 md:pt-32 px-4 pb-20">
                <div className="flex items-center gap-4 mb-10">
                    <Link href="/profile" className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                        <ChevronLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-black uppercase tracking-tighter">Edit Neural Identity</h1>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8 md:p-12 space-y-10 shadow-2xl backdrop-blur-xl">
                    {/* Avatar Edit */}
                    <div className="flex flex-col items-center">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full p-[3px] bg-gradient-to-tr from-orange-400 to-rose-600">
                                <div className="w-full h-full rounded-full bg-black border-[4px] border-black overflow-hidden relative">
                                    <img src={editAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.public_key}`} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera size={24} className="text-white" />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={randomizeAvatar}
                                className="absolute -bottom-2 -right-2 bg-white text-black p-2 rounded-full hover:scale-110 transition-transform shadow-lg"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Transmitter Tag</label>
                            <input
                                value={editUsername}
                                onChange={e => setEditUsername(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors font-bold"
                                placeholder="username"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Neural Bio</label>
                            <textarea
                                value={editBio}
                                onChange={e => setEditBio(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors min-h-[120px] resize-none font-medium leading-relaxed"
                                placeholder="Tell your story..."
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">Signal Interests</label>
                            <div className="flex flex-wrap gap-2 px-2">
                                {INTEREST_OPTIONS.map(interest => {
                                    const isSelected = editInterests.includes(interest);
                                    return (
                                        <button
                                            key={interest}
                                            onClick={() => setEditInterests(prev =>
                                                prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
                                            )}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? "bg-orange-500 text-black border border-orange-400" : "bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10"
                                                }`}
                                        >
                                            {interest}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-5 bg-gradient-to-r from-orange-500 to-rose-600 text-black font-black uppercase text-sm tracking-[0.2em] rounded-2xl shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saving ? "SYNCING..." : "CONFIRM CONFIGURATION"}
                    </button>
                </div>
            </main>
        </div>
    );
}
