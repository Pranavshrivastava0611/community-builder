"use client";

import CommunityChat from "@/components/CommunityChat";
import CommunityFeed from "@/components/CommunityFeed";
import GlassPanel from "@/components/GlassPanel";
import GlowButton from "@/components/GlowButton";
import HoldersLeaderboard from "@/components/HoldersLeaderboard";
import Navbar from "@/components/Navbar";
import TokenGraph from "@/components/TokenGraph";
import { supabase } from "@/utils/supabase";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Minus, Plus, SignalHigh } from "lucide-react";
import Link from "next/link";
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
    token_symbol?: string;
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
    const [activeTab, setActiveTab] = useState<"overview" | "market" | "feed" | "chat" | "live" | "manage">("overview");
    const [streamStatus, setStreamStatus] = useState<'live' | 'idle'>('idle');
    const [managementData, setManagementData] = useState<any>(null);
    const [claiming, setClaiming] = useState(false);

    const [community, setCommunity] = useState<CommunityDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>();
    const [creatorWallet, setCreatorWallet] = useState<string | undefined>();

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

                // Fetch creator's public key for Superchats
                if (data.community.creator_id) {
                    const pRes = await fetch(`/api/profile?id=${data.community.creator_id}`);
                    const pData = await pRes.json();
                    if (pData.profile) setCreatorWallet(pData.profile.public_key);
                    if (pData.profile) console.log("creatorWallet", pData.profile.public_key);
                }

                // Fetch stream status
                const sRes = await fetch(`/api/streams/status?room=${data.community.id}`);
                const sData = await sRes.json();
                if (sData.stream) setStreamStatus(sData.stream.status);

            } catch (error) {
                console.error(error);
                toast.error("Could not load community details");
            } finally {
                setLoading(false);
            }
        }

        async function fetchManagement() {
            if (!community?.id || currentUserId !== community.creator_id) return;
            try {
                const token = localStorage.getItem("authToken");
                const res = await fetch(`/api/communities/id/${community.id}/management`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setManagementData(data);
                }
            } catch (e) {
                console.error("Management fetch error", e);
            }
        }

        if (communityName) fetchData();
        if (community?.id) fetchManagement();
    }, [communityName, community?.id, connected, currentUserId]); // Refetch if wallet connects/auth changes

    useEffect(() => {
        if (!community?.id || !supabase) return;

        const channel = supabase
            .channel(`stream-status-${community.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'live_streams',
                    filter: `community_id=eq.${community.id}`
                },
                (payload: any) => {
                    console.log('Stream Status Change:', payload.new?.status);
                    if (payload.new) {
                        setStreamStatus(payload.new.status);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [community?.id]);

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

    const handleClaimFees = async () => {
        if (!connected || !publicKey) return;
        try {
            setClaiming(true);
            const token = localStorage.getItem("authToken");
            const res = await fetch(`/api/communities/id/${community!.id}/management/claim-fees`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to build transaction");

            const { Connection, clusterApiUrl, Transaction } = await import("@solana/web3.js");
            const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || clusterApiUrl("devnet"), "confirmed");
            const { decode } = await import("bs58");

            const transactions = data.transactions || [data.transaction]; // Handle both array and single (legacy)

            for (const txStr of transactions) {
                const tx = Transaction.from(decode(txStr));
                const signature = await (window as any).solana.signAndSendTransaction(tx);
                await connection.confirmTransaction(signature.signature, "confirmed");
            }

            toast.success("Successfully claimed all accrued fees!");
            // Refresh data
            const mRes = await fetch(`/api/communities/id/${community!.id}/management`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (mRes.ok) setManagementData(await mRes.json());

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to claim fees");
        } finally {
            setClaiming(false);
        }
    };

    const handleRemoveLiquidity = async (positionKey: string) => {
        if (!connected || !publicKey) return;
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch(`/api/communities/id/${community!.id}/liquidity/remove`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userPublicKey: publicKey.toBase58(),
                    positionPubKey: positionKey,
                    bps: 5000, // 50% fixed for now as MVP
                    shouldClaimAndClose: false
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");

            const { Connection, clusterApiUrl, Transaction } = await import("@solana/web3.js");
            const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || clusterApiUrl("devnet"), "confirmed");
            const { decode } = await import("bs58");

            if (data.transactions) {
                for (const txStr of data.transactions) {
                    const tx = Transaction.from(decode(txStr));
                    const signature = await (window as any).solana.signAndSendTransaction(tx);
                    await connection.confirmTransaction(signature.signature, "confirmed");
                }
            }

            toast.success("Liquidity removed successfully!");
            const mRes = await fetch(`/api/communities/id/${community!.id}/management`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (mRes.ok) setManagementData(await mRes.json());

        } catch (e: any) {
            toast.error(e.message || "Remove failed");
        }
    };

    const handleAddLiquidity = async (positionKey: string) => {
        if (!connected || !publicKey) return;
        try {
            const token = localStorage.getItem("authToken");

            const inputX = window.prompt("Enter amount of SOL to add:", "0.1");
            if (!inputX || isNaN(Number(inputX))) return;

            const inputY = window.prompt(`Enter amount of ${community?.token_symbol || "TOKEN"} to add:`, "100");
            if (!inputY || isNaN(Number(inputY))) return;

            toast.loading("Preparing liquidity addition...");

            const res = await fetch(`/api/communities/id/${community!.id}/liquidity/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userPublicKey: publicKey.toBase58(),
                    positionPubKey: positionKey,
                    // We send UI amounts now to let backend use correct decimals
                    uiAmountX: inputX,
                    uiAmountY: inputY,
                    // Fallback (legacy/ignored by new backend logic but good for types)
                    amountX: 0,
                    amountY: 0,
                    slippage: 1.0
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");

            const { Connection, clusterApiUrl, Transaction } = await import("@solana/web3.js");
            const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || clusterApiUrl("devnet"), "confirmed");
            const { decode } = await import("bs58");

            const tx = Transaction.from(decode(data.transaction));
            const signature = await (window as any).solana.signAndSendTransaction(tx);
            await connection.confirmTransaction(signature.signature, "confirmed");

            toast.dismiss();
            toast.success("Liquidity added successfully!");
            const mRes = await fetch(`/api/communities/id/${community!.id}/management`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (mRes.ok) setManagementData(await mRes.json());

        } catch (e: any) {
            toast.dismiss();
            toast.error(e.message || "Add failed");
        }
    };

    const [swapDirection, setSwapDirection] = useState<"buy" | "sell">("buy"); // buy = SOL -> Token, sell = Token -> SOL

    const handleSwap = async (amount: string) => {
        if (!connected || !publicKey) {
            toast.error("Connect wallet to swap");
            return;
        }
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error("Enter valid amount");
            return;
        }

        try {
            const token = localStorage.getItem("authToken");
            const inToken = swapDirection === "buy"
                ? "So11111111111111111111111111111111111111112" // WSOL
                : community!.token_mint_address;

            // If buying (User sells SOL), amount is in SOL (9 decimals)
            // If selling (User sells Token), amount is in Token (Assume 9 for simple if missing, but usually 6 or 9. We'll use 9 default or generic)
            // Ideally we fetch decimals. For now assuming 9 for generic standard or same as SOL.
            const decimals = 9;
            const inAmount = Math.floor(Number(amount) * Math.pow(10, decimals));

            const res = await fetch(`/api/communities/id/${community!.id}/swap`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    userPublicKey: publicKey.toBase58(),
                    inToken,
                    inAmount,
                    slippage: 1.0
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Swap failed");

            const { Connection, clusterApiUrl, Transaction } = await import("@solana/web3.js");
            const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || clusterApiUrl("devnet"), "confirmed");
            const { decode } = await import("bs58");

            const tx = Transaction.from(decode(data.transaction));
            const signature = await (window as any).solana.signAndSendTransaction(tx);
            await connection.confirmTransaction(signature.signature, "confirmed");

            toast.success(`Swapped ${amount} SOL successfully!`);

        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Swap failed");
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

            <main className={`relative z-10 mx-auto px-4 md:px-10 pb-20 transition-all duration-500 ${activeTab === "live" ? "max-w-[1800px] pt-4" : "max-w-7xl pt-12"}`}>

                {/* Banner Section - Hidden in Live Mode */}
                {activeTab !== "live" && (
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
                )}

                <div className={activeTab === "live" ? "w-full" : "grid grid-cols-1 lg:grid-cols-3 gap-10"}>
                    <div className={activeTab === "live" ? "w-full mb-8" : "lg:col-span-2 space-y-8"}>

                        {/* Tabs */}
                        <div className="flex gap-4 border-b border-white/10 pb-1 mb-6">
                            <button
                                onClick={() => setActiveTab("overview")}
                                className={`pb-3 text-lg font-bold transition-colors ${activeTab === "overview" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-white"}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab("market")}
                                className={`pb-3 text-lg font-bold transition-colors ${activeTab === "market" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-white"}`}
                            >
                                Market
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
                            <button
                                onClick={async () => {
                                    setActiveTab("live");
                                    // Manual re-check when entering tab
                                    if (community?.id) {
                                        const sRes = await fetch(`/api/streams/status?room=${community.id}`);
                                        const sData = await sRes.json();
                                        if (sData.stream) setStreamStatus(sData.stream.status);
                                    }
                                }}
                                className={`pb-3 text-lg font-bold transition-colors flex items-center gap-2 ${activeTab === "live" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-white"}`}
                            >
                                Live
                                {streamStatus === 'live' && (
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                                    </span>
                                )}
                            </button>
                            {community.creator_id === currentUserId && (
                                <button
                                    onClick={() => setActiveTab("manage")}
                                    className={`pb-3 text-lg font-bold transition-colors ${activeTab === "manage" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-white"}`}
                                >
                                    Admin
                                </button>
                            )}
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
                                recipientWallet={creatorWallet}
                            />
                        )}

                        {activeTab === "market" && (
                            <div className="space-y-6">
                                <GlassPanel className="p-8 rounded-[2.5rem] border border-white/10 bg-black/40 shadow-2xl overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                            <span className="text-[9px] font-black uppercase text-orange-400">Live Nexus Data</span>
                                        </div>
                                    </div>
                                    <TokenGraph
                                        communityId={community.id}
                                        tokenSymbol={community.token_symbol || "TOKEN"}
                                    />
                                </GlassPanel>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Swap Card */}
                                    <GlassPanel className="p-6 rounded-3xl border border-white/5 bg-white/5 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">
                                                Active
                                            </div>
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Instant Swap</h4>
                                        <div className="space-y-4">
                                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                                                    Sell ({swapDirection === "buy" ? "SOL" : (community.token_symbol || "TOKEN")})
                                                </label>
                                                <input
                                                    type="number"
                                                    id="swapInputApi"
                                                    placeholder="0.0"
                                                    className="w-full bg-transparent text-white font-mono font-bold outline-none placeholder:text-gray-700"
                                                />
                                            </div>
                                            <div className="flex justify-center -my-2 relative z-10">
                                                <button
                                                    onClick={() => setSwapDirection(prev => prev === "buy" ? "sell" : "buy")}
                                                    className="bg-white/10 p-1 rounded-full backdrop-blur-md hover:bg-white/20 transition-all cursor-pointer"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 transform hover:rotate-180 transition-transform"><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>
                                                </button>
                                            </div>
                                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                                                    Buy ({swapDirection === "buy" ? (community.token_symbol || "TOKEN") : "SOL"})
                                                </label>
                                                <div className="w-full text-gray-500 font-mono font-bold text-sm">
                                                    Calculated at Sign
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const val = (document.getElementById("swapInputApi") as HTMLInputElement).value;
                                                    handleSwap(val);
                                                }}
                                                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all"
                                            >
                                                Swap Now
                                            </button>
                                        </div>
                                    </GlassPanel>

                                    {/* Quick Adds (Placeholder for now, focused on Swap) */}
                                    <GlassPanel className="p-6 rounded-3xl border border-white/5 bg-white/5 flex flex-col justify-center items-center text-center">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Liquidity Provider</h4>
                                        <p className="text-xs text-gray-400 mb-6 max-w-[200px]">Earn fees by providing liquidity to the {community.token_symbol} pool.</p>
                                        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-all">
                                            Add Liquidity
                                        </button>
                                    </GlassPanel>
                                </div>
                            </div>
                        )}

                        {activeTab === "manage" && managementData && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <GlassPanel className="p-8 rounded-[2.5rem] border border-orange-500/20 bg-orange-500/5 backdrop-blur-2xl">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-6">Accrued Swap Fees</h3>
                                        <div className="space-y-4 mb-8">
                                            <div className="flex justify-between items-center group">
                                                <span className="text-gray-400 text-sm font-bold uppercase tracking-tighter">{managementData.totalFees.xSymbol}</span>
                                                <span className="text-2xl font-black text-white group-hover:text-orange-400 transition-colors">{(managementData.totalFees.x || 0).toFixed(6)}</span>
                                            </div>
                                            <div className="flex justify-between items-center group">
                                                <span className="text-gray-400 text-sm font-bold uppercase tracking-tighter">{managementData.totalFees.ySymbol}</span>
                                                <span className="text-2xl font-black text-white group-hover:text-orange-400 transition-colors">{(managementData.totalFees.y || 0).toFixed(6)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleClaimFees}
                                            disabled={claiming || (managementData.totalFees.x === 0 && managementData.totalFees.y === 0)}
                                            className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50 disabled:grayscale"
                                        >
                                            {claiming ? "Processing Nexus..." : "Claim All Revenue"}
                                        </button>
                                    </GlassPanel>

                                    <GlassPanel className="p-8 rounded-[2.5rem] border border-white/10 bg-white/5">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Management Interface</h3>
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                                <div className="text-xs font-black text-white uppercase mb-1">Fee Tier</div>
                                                <div className="text-orange-400 text-sm font-bold">0.05% Dynamic</div>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                                <div className="text-xs font-black text-white uppercase mb-1">Pool Governance</div>
                                                <div className="text-blue-400 text-sm font-bold italic tracking-tighter">Automatic Bin Management Enabled</div>
                                            </div>
                                        </div>
                                    </GlassPanel>
                                </div>

                                <GlassPanel className="p-8 rounded-[2.5rem] border border-white/10 bg-white/5">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Active Positions</h3>
                                    <div className="space-y-3">
                                        {managementData.positions.map((pos: any) => (
                                            <div key={pos.publicKey} className="flex justify-between items-center p-4 rounded-xl bg-black/20 border border-white/5 hover:border-white/20 transition-all">
                                                <div className="flex gap-2 mr-3">
                                                    <button
                                                        onClick={() => handleAddLiquidity(pos.publicKey)}
                                                        className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors"
                                                        title="Add Liquidity (0.2 SOL)"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveLiquidity(pos.publicKey)}
                                                        className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                                                        title="Remove 50% Liquidity"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                </div>
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Position Link</span>
                                                    <span className="text-[10px] font-mono text-gray-400">{pos.publicKey.slice(0, 8)}...{pos.publicKey.slice(-8)}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black text-gray-600 uppercase mb-1">Pending</div>
                                                    <div className="text-xs font-black text-white">{(pos.feesX || 0).toFixed(4)} / {(pos.feesY || 0).toFixed(4)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </GlassPanel>
                            </div>
                        )}

                        {activeTab === "live" && (
                            <div className="py-12 flex flex-col items-center justify-center border border-white/10 rounded-[40px] bg-gradient-to-b from-orange-500/5 to-transparent backdrop-blur-sm relative overflow-hidden">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/20 rounded-full blur-[80px] -z-10" />

                                <div className="w-20 h-20 rounded-full bg-black border border-orange-500/50 flex items-center justify-center mb-6 relative">
                                    <SignalHigh size={32} className="text-orange-500" />
                                    {streamStatus === 'live' && (
                                        <div className="absolute -top-1 -right-1 flex h-4 w-4">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600"></span>
                                        </div>
                                    )}
                                </div>

                                <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">
                                    {streamStatus === 'live' ? "Signal Detected" : "Channel Interface"}
                                </h2>
                                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-8">
                                    {streamStatus === 'live' ? "High-priority transmission in progress" : "Station currently on standby"}
                                </p>

                                <Link href={`/communities/${encodeURIComponent(community.name)}/live`}>
                                    <GlowButton className="px-10 py-4 text-sm">
                                        {streamStatus === 'live' ? "Join Transmission" : "Enter Control Center"}
                                    </GlowButton>
                                </Link>

                                <div className="mt-12 grid grid-cols-2 gap-8 text-center bg-black/40 p-6 rounded-2xl border border-white/5">
                                    <div>
                                        <div className="text-white font-black text-xl uppercase">Neural</div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Chat Link</div>
                                    </div>
                                    <div>
                                        <div className="text-white font-black text-xl uppercase">SOL</div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Superchat</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab !== "live" && (
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
                        )}
                    </div>

                    {/* Right Column: Stats & Token Info */}
                    {/* Right Column: Stats & Token Info - Hidden in Live Mode */}
                    {activeTab !== "live" && (
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
                    )}
                </div>

            </main>
        </div>
    );
}
