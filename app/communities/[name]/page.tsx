"use client";

import CommunityChat from "@/components/CommunityChat";
import CommunityFeed from "@/components/CommunityFeed";
import GlassPanel from "@/components/GlassPanel";
import GlowButton from "@/components/GlowButton";
import HoldersLeaderboard from "@/components/HoldersLeaderboard";
import Navbar from "@/components/Navbar";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";

interface CommunityDetail {
    id: string;
    name: string;
    description: string;
    image_url: string;
    token_mint_address: string;
    token_metadata_uri: string;
    meteora_lb_pair_address?: string;
    members: number;
    isJoined: boolean;
    creator_id: string;
}

export default function CommunityDetailPage() {
    const params = useParams(); // Use hook for client component
    const communityName = decodeURIComponent(params!.name as string);
    const router = useRouter();
    const { connected, publicKey } = useWallet();
    const [activeTab, setActiveTab] = useState<"overview" | "feed" | "chat">("overview");

    const [community, setCommunity] = useState<CommunityDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>();

    useEffect(() => {
        async function fetchData() {
            try {
                const token = localStorage.getItem("authToken");
                const headers: any = {};
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        setCurrentUserId(payload.id);
                    } catch (e) { }
                }

                const res = await fetch(`/api/communities/${encodeURIComponent(communityName)}`, {
                    headers
                });

                if (!res.ok) throw new Error("Failed to load community");

                const data = await res.json();
                setCommunity(data.community);
            } catch (error) {
                console.error(error);
                toast.error("Could not load community details");
            } finally {
                setLoading(false);
            }
        }

        if (communityName) fetchData();
    }, [communityName, connected]); // Refetch if wallet connects/auth changes

    const handleJoin = async () => {
        if (!connected) {
            toast.error("Please connect your wallet first");
            return;
        }

        if (!community) return;

        try {
            setJoining(true);
            const token = localStorage.getItem("authToken");
            if (!token) {
                toast.error("Please sign in first");
                return;
            }

            const res = await fetch("/api/community/join", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ communityId: community.id })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to join");

            toast.success(`Welcome to ${community.name}!`);
            setCommunity(prev => prev ? ({ ...prev, isJoined: true, members: prev.members + 1 }) : null);

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-pulse text-orange-400">Loading Community...</div>
            </div>
        );
    }

    if (!community) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
                <h2 className="text-2xl font-bold">Community Not Found</h2>
                <GlowButton onClick={() => router.push("/communities")}>Go Back</GlowButton>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans relative overflow-x-hidden selection:bg-orange-500/30">
            <Toaster position="bottom-right" />
            {/* Background Visuals */}
            <div className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none opacity-20"></div>
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-orange-900/10 to-transparent pointer-events-none"></div>

            <Navbar />

            <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 pt-12 pb-20">

                {/* Banner Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-64 md:h-80 rounded-3xl overflow-hidden relative border border-white/10 shadow-2xl mb-10 group"
                >
                    <img
                        src={community.image_url || "/images/placeholder-community.jpg"}
                        alt={community.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                    <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
                        <h1 className="text-4xl md:text-6xl font-black font-heading tracking-tighter mb-2 text-white drop-shadow-lg">
                            {community.name}
                        </h1>
                        <div className="flex items-center gap-4 text-sm font-mono">
                            <span className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-lg border border-orange-500/30 backdrop-blur-md">
                                {community.members.toLocaleString()} Members
                            </span>
                            {community.meteora_lb_pair_address && (
                                <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg border border-green-500/30 backdrop-blur-md">
                                    Liquidity Pool Live
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">

                        {/* Tabs */}
                        <div className="flex gap-4 border-b border-white/10 pb-1 mb-6">
                            <button
                                onClick={() => setActiveTab("overview")}
                                className={`pb-3 text-lg font-bold transition-colors ${activeTab === "overview" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-white"}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab("feed")}
                                className={`pb-3 text-lg font-bold transition-colors ${activeTab === "feed" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-white"}`}
                            >
                                Feed
                            </button>
                            <button
                                onClick={() => setActiveTab("chat")}
                                className={`pb-3 text-lg font-bold transition-colors ${activeTab === "chat" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-white"}`}
                            >
                                Chat
                            </button>
                        </div>

                        {activeTab === "overview" && (
                            <GlassPanel className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                                <h2 className="text-2xl font-bold mb-4 text-orange-100">About</h2>
                                <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                                    {community.description}
                                </p>
                            </GlassPanel>
                        )}

                        {activeTab === "feed" && (
                            <CommunityFeed
                                communityId={community.id}
                                isMember={community.isJoined}
                            />
                        )}

                        {activeTab === "chat" && (
                            <CommunityChat
                                communityId={community.id}
                                currentWallet={publicKey?.toBase58()}
                                isMember={community.isJoined}
                            />
                        )}

                        <div className="flex flex-col md:flex-row gap-4">
                            {community.isJoined ? (
                                <button disabled className="flex-1 py-4 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl font-bold font-mono uppercase tracking-wide cursor-default">
                                    ✓ Joined
                                </button>
                            ) : (
                                <GlowButton onClick={handleJoin} disabled={joining} className="flex-1 py-4 text-xl">
                                    {joining ? "Joining..." : "Join Community"}
                                </GlowButton>
                            )}

                            <button className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold font-mono uppercase tracking-wide transition-all duration-300">
                                Share
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Stats & Token Info */}
                    <div className="space-y-6">
                        <GlassPanel className="p-6 rounded-2xl border border-white/10 bg-white/5">
                            <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest mb-4">Token Info</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="block text-xs text-gray-500 mb-1">Mint Address</span>
                                    <div className="flex items-center gap-2 bg-black/30 p-3 rounded-lg border border-white/5">
                                        <code className="text-orange-400 text-xs truncate">
                                            {community.token_mint_address}
                                        </code>
                                    </div>
                                </div>
                                {community.meteora_lb_pair_address && (
                                    <div>
                                        <span className="block text-xs text-gray-500 mb-1">DLMM Pool</span>
                                        <div className="flex items-center gap-2 bg-black/30 p-3 rounded-lg border border-white/5">
                                            <code className="text-blue-400 text-xs truncate">
                                                {community.meteora_lb_pair_address}
                                            </code>
                                        </div>
                                        <a
                                            href={`https://app.meteora.ag/dlmm/${community.meteora_lb_pair_address}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block mt-2 text-xs text-center text-gray-400 hover:text-white underline"
                                        >
                                            View on Meteora
                                        </a>
                                    </div>
                                )}
                            </div>
                        </GlassPanel>

                        <GlassPanel className="p-6 rounded-2xl border border-white/10 bg-white/5">
                            <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest mb-4">Community Stats</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl text-center">
                                    <div className="text-2xl font-black text-white">{community.members}</div>
                                    <div className="text-xs text-gray-500">Members</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl text-center">
                                    <div className="text-2xl font-black text-white">$0</div>
                                    <div className="text-xs text-gray-500">Volume (24h)</div>
                                </div>
                            </div>
                        </GlassPanel>

                        <HoldersLeaderboard
                            communityId={community.id}
                            creatorId={community.creator_id}
                            currentUserId={currentUserId}
                        />
                    </div>
                </div>

            </main>
        </div>
    );
}
