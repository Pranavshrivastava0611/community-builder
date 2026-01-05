"use client";

import { supabase } from "@/utils/supabase";
import {
    LiveKitRoom,
    RoomAudioRenderer,
    VideoConference,
    useParticipants
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import GlowButton from "./GlowButton";
import SuperchatOverlay from "./SuperchatOverlay";

interface BroadcasterDashboardProps {
    room: string;
    username: string;
}

function StreamStats({ onStatsChange }: { onStatsChange: (count: number) => void }) {
    const participants = useParticipants();

    useEffect(() => {
        onStatsChange(participants.length);
    }, [participants, onStatsChange]);

    return null;
}

export default function BroadcasterDashboard({ room, username }: BroadcasterDashboardProps) {
    const [token, setToken] = useState("");
    const [isLive, setIsLive] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    const [revenue, setRevenue] = useState(0);

    const fetchRevenue = async () => {
        if (!room) return;
        const { data, error } = await supabase
            .from('community_chat_messages')
            .select('superchat_amount')
            .eq('community_id', room)
            .eq('is_superchat', true);

        if (data) {
            const total = data.reduce((acc, curr) => acc + (curr.superchat_amount || 0), 0);
            setRevenue(total);
        }
    };

    useEffect(() => {
        if (isLive) {
            fetchRevenue();

            // Listen for new superchats to update revenue real-time
            const channel = supabase
                .channel(`revenue-tracker-${room}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'community_chat_messages',
                    filter: `community_id=eq.${room}`
                }, (payload) => {
                    if (payload.new.is_superchat) {
                        setRevenue(prev => prev + (payload.new.superchat_amount || 0));
                    }
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [isLive, room]);

    const startStream = async () => {
        try {
            const resp = await fetch('/api/streams/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username, role: 'streamer' })
            });
            const data = await resp.json();
            setToken(data.token);
            setIsLive(true);

            await fetch('/api/streams/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, status: 'live' })
            });
        } catch (e) {
            console.error(e);
        }
    };

    const endStream = async () => {
        setToken("");
        setIsLive(false);
        await fetch('/api/streams/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room, status: 'idle' })
        });
    };

    if (!isLive) {
        return (
            <div className="relative group overflow-hidden h-full min-h-[400px]">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-rose-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="h-full flex flex-col items-center justify-center p-8 bg-neutral-900 border border-white/10 rounded-[40px] text-center space-y-8 relative z-10">
                    <div className="w-24 h-24 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-orange-500/20 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                        <Users className="w-10 h-10 text-orange-500" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Broadcaster Control</h2>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Ready to link with community transmitters</p>
                    </div>
                    <GlowButton onClick={startStream} className="w-full max-w-md mx-auto py-5 text-[11px] font-black uppercase tracking-[0.3em] bg-orange-600 border-none transition-all">
                        Establish Uplink
                    </GlowButton>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="relative flex-1 bg-black rounded-[40px] overflow-hidden border border-orange-500/30 shadow-[0_0_80px_rgba(249,115,22,0.1)] group">
                <LiveKitRoom
                    video={true}
                    audio={true}
                    token={token}
                    serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                    onDisconnected={endStream}
                    connect={true}
                    className="h-full"
                >
                    <VideoConference />
                    <RoomAudioRenderer />
                    <StreamStats onStatsChange={setViewerCount} />
                    <SuperchatOverlay communityId={room} />
                </LiveKitRoom>

                <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-red-600/30 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_rgba(220,38,38,1)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-500">LIVE</span>
                    </div>
                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                        <Users size={12} className="text-gray-400" />
                        <span className="text-[10px] font-black text-white">{viewerCount}</span>
                    </div>
                </div>

                <div className="absolute top-6 right-6 z-20">
                    <button
                        onClick={endStream}
                        className="bg-neutral-900 border border-white/20 hover:bg-red-600 hover:border-red-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2.5 rounded-full transition-all active:scale-95 shadow-2xl"
                    >
                        Terminate Signal
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 h-24">
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col justify-center">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Session Revenue</p>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                            <Zap size={14} className="text-yellow-500" />
                        </div>
                        <p className="text-white font-black text-xl uppercase tracking-tighter">
                            {revenue.toFixed(2)} <span className="text-gray-500 text-xs">SOL</span>
                        </p>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col justify-center">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Viewer Presence</p>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Users size={14} className="text-blue-500" />
                        </div>
                        <p className="text-white font-black text-xl tracking-tighter">
                            {viewerCount} <span className="text-gray-500 text-[10px] uppercase font-bold">Active Syncs</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
