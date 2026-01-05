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
            const resp = await fetch(
                `/api/streams/token?room=${room}&username=${username}`
            );
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
            <div className="p-8 bg-neutral-900/50 border border-white/10 rounded-3xl text-center space-y-6">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/20">
                    <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Broadcast Center</h2>
                    <p className="text-gray-500 text-sm mt-1">Ready to transmit your signals to the community?</p>
                </div>
                <GlowButton onClick={startStream} className="w-full py-4 text-sm">
                    Go Live Now
                </GlowButton>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.15)] relative">
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

                <div className="absolute top-4 right-4 z-10">
                    <button
                        onClick={endStream}
                        className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-colors shadow-xl"
                    >
                        End Stream
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Status</p>
                    <p className="text-green-500 font-bold text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Transmitting
                    </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Room</p>
                    <p className="text-white font-mono text-xs">{room}</p>
                </div>
            </div>
        </div>
    );
}
