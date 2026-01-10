"use client";

import LiveStreamingRoom from "@/components/LiveStreamingRoom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/utils/supabase";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";

interface CommunityDetail {
    id: string;
    name: string;
    description: string;
    image_url: string;
    token_mint_address: string;
    token_metadata_uri: string;
    token_symbol?: string;
    members: number;
    isJoined: boolean;
    creator_id: string;
}

export default function CommunityLivePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
        }>
            <CommunityLiveContent />
        </Suspense>
    );
}

function CommunityLiveContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const communityName = decodeURIComponent(params!.name as string);
    const targetRoom = searchParams?.get("room");
    const { connected, publicKey } = useWallet();
    const router = useRouter();

    const [community, setCommunity] = useState<CommunityDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>();
    const [creatorWallet, setCreatorWallet] = useState<string | undefined>();

    const [activeStreams, setActiveStreams] = useState<any[]>([]);
    const [selectedStream, setSelectedStream] = useState<any | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

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
                }

                // Fetch all active streams for this community
                const sRes = await fetch(`/api/streams/status?communityId=${data.community.id}`);
                const sData = await sRes.json();
                const streams = sData.streams || [];
                setActiveStreams(streams);

                // Auto-select if room param exists
                if (targetRoom) {
                    const found = streams.find((s: any) => s.room_name === targetRoom);
                    if (found) setSelectedStream(found);
                }

            } catch (error) {
                console.error(error);
                toast.error("Could not load transmission data");
            } finally {
                setLoading(false);
            }
        }

        if (communityName) fetchData();
    }, [communityName, targetRoom]);

    useEffect(() => {
        if (!community?.id || !supabase) return;

        const channel = supabase
            .channel(`stream-status-live-${community.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'live_streams',
                    filter: `community_id=eq.${community.id}`
                },
                (payload: any) => {
                    if (payload.new) {
                        setActiveStreams(prev => {
                            const exists = prev.find(s => s.room_name === payload.new.room_name);
                            if (payload.new.status === 'live') {
                                if (exists) return prev.map(s => s.room_name === payload.new.room_name ? payload.new : s);
                                return [...prev, payload.new];
                            } else {
                                return prev.filter(s => s.room_name !== payload.new.room_name);
                            }
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [community?.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                    <span className="text-orange-500 font-black uppercase tracking-widest text-xs animate-pulse">Syncing Hub...</span>
                </div>
            </div>
        );
    }

    if (!community) return null;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-orange-500/30 font-sans">
            <Toaster position="bottom-right" />
            <Navbar />

            <main className="max-w-[1800px] mx-auto px-4 md:px-10 pt-6 pb-20">
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => selectedStream || isBroadcasting ? (setSelectedStream(null), setIsBroadcasting(false)) : router.back()}
                            className="bg-white/5 hover:bg-white/10 p-3 rounded-2xl border border-white/10 transition-all group"
                        >
                            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter">
                                {community.name} <span className="text-orange-500">Live</span>
                            </h1>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                                <span className="text-orange-500">Transmission Sector A-1</span>
                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                <span>{activeStreams.length} Active Links</span>
                            </div>
                        </div>
                    </div>

                    {!isBroadcasting && !selectedStream && (
                        <button
                            onClick={() => setIsBroadcasting(true)}
                            className="bg-orange-600 hover:bg-orange-500 text-white px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[11px] border border-orange-400/30 transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)] active:scale-95"
                        >
                            <span className="hidden sm:inline">Start Broadcast</span>
                            <span className="sm:hidden">Go Live</span>
                        </button>
                    )}
                </motion.header>

                {(isBroadcasting || selectedStream) ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <LiveStreamingRoom
                            community={community}
                            isBroadcaster={isBroadcasting}
                            currentWallet={publicKey?.toBase58()}
                            recipientWallet={isBroadcasting ? undefined : (selectedStream?.streamer_id === community?.creator_id ? creatorWallet : undefined)}
                            isMember={community.isJoined}
                            streamStatus={isBroadcasting ? 'idle' : 'live'}
                            tokenMintAddress={community.token_mint_address}
                            tokenSymbol={community.token_symbol}
                            // Custom props for the room to handle unique names
                            roomName={selectedStream?.room_name}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 scrollbar-hide">
                        {activeStreams.length === 0 ? (
                            <div className="col-span-full h-[500px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-[40px] bg-white/[0.02] backdrop-blur-sm">
                                <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center mb-6 bg-white/5 animate-pulse">
                                    <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-400 uppercase tracking-widest">No Active Transmissions</h3>
                                <p className="text-gray-600 text-xs mt-4 font-bold uppercase tracking-[0.2em]">Be the first to establish a neural link</p>
                                <button
                                    onClick={() => setIsBroadcasting(true)}
                                    className="mt-8 px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                                >
                                    Initiate Primary Link
                                </button>
                            </div>
                        ) : (
                            activeStreams.map((stream) => (
                                <motion.div
                                    key={stream.room_name}
                                    whileHover={{ scale: 1.02, y: -5 }}
                                    onClick={() => setSelectedStream(stream)}
                                    className="cursor-pointer group relative aspect-video rounded-[32px] overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl transition-all hover:border-orange-500/50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-tr from-orange-600/20 to-rose-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                                        <div className="bg-red-600 text-[8px] font-black uppercase tracking-widest text-white px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-lg">
                                            <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                            Live
                                        </div>
                                    </div>

                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
                                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-orange-500 transition-all">
                                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-6 left-6 right-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 text-xs font-black">
                                                {stream.streamer_name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-black uppercase tracking-tighter text-lg leading-none">
                                                    {stream.streamer_name || "Anonymous"}
                                                </h3>
                                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">
                                                    Syncing via Sector A
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
