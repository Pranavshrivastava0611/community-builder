"use client";

import { SignalHigh, Zap } from "lucide-react";
import { useState } from "react";
import BroadcasterDashboard from "./BroadcasterDashboard";
import CommunityChat from "./CommunityChat";
import GlowButton from "./GlowButton";
import LiveStreamView from "./LiveStreamView";
import SuperchatModal from "./SuperchatModal";

interface LiveStreamingRoomProps {
    community: any;
    isBroadcaster: boolean;
    currentWallet?: string;
    recipientWallet?: string;
    tokenMintAddress?: string;
    tokenSymbol?: string;
    isMember: boolean;
    streamStatus: 'live' | 'idle';
}

export default function LiveStreamingRoom({
    community,
    isBroadcaster,
    currentWallet,
    recipientWallet,
    tokenMintAddress,
    tokenSymbol,
    isMember,
    streamStatus
}: LiveStreamingRoomProps) {
    const [isSuperchatOpen, setIsSuperchatOpen] = useState(false);
    console.log("LiveStreamingRoom: recipientWallet =", recipientWallet);

    const isActuallyLive = streamStatus === 'live' || isBroadcaster;

    return (
        <div className="max-w-[1800px] mx-auto flex flex-col lg:flex-row gap-4 h-full min-h-[80vh]">
            {/* Left Column: Video & Metadata */}
            <div className="flex-1 flex flex-col gap-4">
                {/* Video Container */}
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/5 shadow-2xl group">
                    {isBroadcaster ? (
                        <BroadcasterDashboard
                            room={community.id}
                            username={currentWallet || "broadcaster"}
                        />
                    ) : isActuallyLive ? (
                        <LiveStreamView
                            room={community.id}
                            username={currentWallet || `viewer-${Math.floor(Math.random() * 1000)}`}
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-neutral-950">
                            <div className="p-6 rounded-full bg-white/5 border border-white/10 animate-pulse">
                                <SignalHigh size={40} className="text-gray-600" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest">Station Offline</h3>
                                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1">Awaiting incoming signals</p>
                            </div>
                        </div>
                    )}

                    {/* Live Badge */}
                    {isActuallyLive && (
                        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                            <div className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                            </div>
                            <span className="bg-red-600 text-[9px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded">Live</span>
                        </div>
                    )}
                </div>

                {/* Simplified Metadata */}
                <div className="mt-4 flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-rose-600 p-[1px]">
                            <div className="w-full h-full rounded-full bg-black overflow-hidden">
                                <img
                                    src={community.image_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${community.name}`}
                                    className="w-full h-full object-cover"
                                    alt=""
                                />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase">{community.name}</h3>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{community.members} Transmitters</p>
                        </div>
                    </div>

                    {!isBroadcaster && (
                        <GlowButton
                            onClick={() => setIsSuperchatOpen(true)}
                            disabled={!recipientWallet}
                            className="px-6 py-2 bg-yellow-500 border-none text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                            <Zap size={14} fill="currentColor" />
                            {recipientWallet ? "Superchat" : "Syncing..."}
                        </GlowButton>
                    )}
                </div>
            </div>

            {/* Right Column: Chat Sidebar (YouTube Style) */}
            <div className="w-full lg:w-[350px] flex flex-col h-[500px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24">
                <div className="flex-1 flex flex-col bg-[#080808] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/60">
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                            Live Feed
                        </h3>
                    </div>

                    <div className="flex-1 min-h-0">
                        <CommunityChat
                            communityId={community.id}
                            currentWallet={currentWallet}
                            isMember={isMember}
                            recipientWallet={recipientWallet}
                            tokenMintAddress={tokenMintAddress}
                            tokenSymbol={tokenSymbol}
                            variant="sidebar"
                        />
                    </div>
                </div>
            </div>

            <SuperchatModal
                isOpen={isSuperchatOpen}
                onClose={() => setIsSuperchatOpen(false)}
                communityId={community.id}
                recipientWallet={recipientWallet || ""}
                tokenMintAddress={tokenMintAddress}
                tokenSymbol={tokenSymbol}
            />
        </div>
    );
}
