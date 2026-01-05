"use client";

import {
    LiveKitRoom,
    RoomAudioRenderer,
    VideoConference
} from "@livekit/components-react";
import "@livekit/components-styles";
import { SignalHigh } from "lucide-react";
import { useEffect, useState } from "react";

interface LiveStreamViewProps {
    room: string;
    username: string;
}

export default function LiveStreamView({ room, username }: LiveStreamViewProps) {
    const [token, setToken] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch('/api/streams/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, username, role: 'viewer' })
                });
                const data = await resp.json();
                setToken(data.token);
            } catch (e) {
                console.error("Transmission Link Failure:", e);
            }
        })();
    }, [room, username]);

    if (token === "") {
        return (
            <div className="flex flex-col items-center justify-center aspect-video bg-neutral-950 border border-white/5 animate-pulse relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                    <div className="h-full w-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/20 via-transparent to-transparent" />
                </div>
                <div className="relative">
                    <div className="w-16 h-16 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-6" />
                    <SignalHigh className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500/20" size={24} />
                </div>
                <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[9px] animate-pulse">Syncing Uplink Sector...</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black relative group selection:bg-orange-500/30">
            <LiveKitRoom
                video={false}
                audio={false}
                token={token}
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                onDisconnected={() => setToken("")}
                className="h-full"
            >
                <VideoConference />
                <RoomAudioRenderer />
            </LiveKitRoom>

            {/* Premium Live Badge Overlay */}
            <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
                <div className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]"></span>
                </div>
                <div className="flex flex-col">
                    <span className="bg-red-600/10 backdrop-blur-md border border-red-600/30 text-[9px] font-black uppercase tracking-[0.2em] text-red-500 px-2 py-0.5 rounded shadow-2xl">
                        RECEIVING SIGNAL
                    </span>
                    <span className="text-[7px] text-gray-400 font-mono mt-0.5 tracking-tighter">ENCRYPTED STREAM</span>
                </div>
            </div>

            {/* Corner Accents */}
            <div className="absolute bottom-6 right-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-sm bg-orange-500/50" />
                    Neural Connection: Optimal
                </div>
            </div>
        </div>
    );
}
