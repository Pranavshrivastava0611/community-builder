"use client";

import {
    LiveKitRoom,
    RoomAudioRenderer,
    VideoConference
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useState } from "react";
import GlowButton from "./GlowButton";

interface BroadcasterDashboardProps {
    room: string;
    username: string;
}

export default function BroadcasterDashboard({ room, username }: BroadcasterDashboardProps) {
    const [token, setToken] = useState("");
    const [isLive, setIsLive] = useState(false);

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

            // Update global stream status
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
            <div className="relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-rose-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="p-16 bg-neutral-900 border border-white/10 rounded-[40px] text-center space-y-8 relative z-10">
                    <div className="w-24 h-24 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-orange-500/20 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                        <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Broadcaster Portal</h2>
                        <p className="text-gray-500 text-xs font-black uppercase tracking-[0.2em]">Establish encrypted community uplink</p>
                    </div>
                    <GlowButton onClick={startStream} className="w-full max-w-md mx-auto py-5 text-[11px] font-black uppercase tracking-[0.3em] bg-orange-600 hover:bg-orange-500 border-none transition-all">
                        Initiate Transmission
                    </GlowButton>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="w-full aspect-video bg-black rounded-[40px] overflow-hidden border border-orange-500/30 shadow-[0_0_80px_rgba(249,115,22,0.2)] relative group">
                <LiveKitRoom
                    video={true}
                    audio={true}
                    token={token}
                    serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                    onDisconnected={endStream}
                    className="h-full"
                >
                    <VideoConference />
                    <RoomAudioRenderer />
                </LiveKitRoom>

                <div className="absolute top-6 right-6 z-20 flex items-center gap-4">
                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_rgba(220,38,38,1)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">ON AIR</span>
                    </div>
                    <button
                        onClick={endStream}
                        className="bg-neutral-900 border border-white/20 hover:bg-red-600 hover:border-red-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2.5 rounded-full transition-all shadow-2xl active:scale-95"
                    >
                        Kill Feed
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] flex items-center justify-between group hover:bg-white/[0.07] transition-colors">
                    <div>
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Uplink Status</p>
                        <p className="text-white font-black text-sm uppercase tracking-tighter flex items-center gap-2">
                            Active Transmission
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] group hover:bg-white/[0.07] transition-colors">
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Sector Identifier</p>
                    <p className="text-white font-mono text-xs opacity-70 group-hover:opacity-100 transition-opacity uppercase">{room}</p>
                </div>
            </div>
        </div>
    );
}
