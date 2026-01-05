"use client";

import LiveStreamingRoom from "@/components/LiveStreamingRoom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/utils/supabase";
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
    token_symbol?: string;
    members: number;
    isJoined: boolean;
    creator_id: string;
}

export default function CommunityLivePage() {
    const params = useParams();
    const communityName = decodeURIComponent(params!.name as string);
    const { connected, publicKey } = useWallet();
    const router = useRouter();

    const [community, setCommunity] = useState<CommunityDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [streamStatus, setStreamStatus] = useState<'live' | 'idle'>('idle');
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
                }

                // Fetch stream status
                const sRes = await fetch(`/api/streams/status?room=${data.community.id}`);
                const sData = await sRes.json();
                if (sData.stream) setStreamStatus(sData.stream.status);

            } catch (error) {
                console.error(error);
                toast.error("Could not load transmission data");
            } finally {
                setLoading(false);
            }
        }

        if (communityName) fetchData();
    }, [communityName]);

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
                        setStreamStatus(payload.new.status);
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
                    <span className="text-orange-500 font-black uppercase tracking-widest text-xs animate-pulse">Syncing Channel...</span>
                </div>
            </div>
        );
    }

    if (!community) return null;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-orange-500/30">
            <Toaster position="bottom-right" />
            <Navbar />

            <main className="max-w-[1800px] mx-auto px-4 md:px-10 pt-6 pb-20">
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="bg-white/5 hover:bg-white/10 p-2 rounded-xl border border-white/10 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tighter">{community.name} <span className="text-orange-500">Live</span></h1>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                <span className="text-orange-500">Transmission Sector A-1</span>
                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                <span>Encrypted Link Stable</span>
                            </div>
                        </div>
                    </div>
                </motion.header>

                <LiveStreamingRoom
                    community={community}
                    isBroadcaster={currentUserId === community.creator_id}
                    currentWallet={publicKey?.toBase58()}
                    recipientWallet={creatorWallet}
                    isMember={community.isJoined}
                    streamStatus={streamStatus}
                    tokenMintAddress={community.token_mint_address}
                    tokenSymbol={community.token_symbol}
                />
            </main>
        </div>
    );
}
