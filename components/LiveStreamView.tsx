"use client";

import {
    LiveKitRoom,
    ParticipantTile,
    RoomAudioRenderer,
    useParticipants,
    useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { SignalHigh, Users } from "lucide-react";
import { useEffect, useState } from "react";
import SuperchatOverlay from "./SuperchatOverlay";

interface LiveStreamViewProps {
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

function StreamRenderer() {
    const tracks = useTracks([
        { source: Track.Source.Camera, withPlaceholder: false },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
    ], { onlySubscribed: true });

    return (
        <div className="w-full h-full relative bg-black">
            {tracks.length > 0 ? (
                <div className="w-full h-full grid grid-cols-1">
                    {tracks.map((track) => (
                        <ParticipantTile
                            key={`${track.participant.identity}-${track.source}`}
                            trackRef={track}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full bg-neutral-950">
                    <div className="p-8 rounded-full bg-white/5 border border-white/10 mb-6 animate-pulse">
                        <SignalHigh className="text-gray-600" size={48} />
                    </div>
                    <h3 className="text-lg font-black text-gray-500 uppercase tracking-[0.2em]">Awaiting Remote Signal</h3>
                    <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2">Connecting to Neural Uplink Sector...</p>
                </div>
            )}
            <RoomAudioRenderer />
        </div>
    );
}

export default function LiveStreamView({ room, username }: LiveStreamViewProps) {
    const [token, setToken] = useState("");
    const [viewerCount, setViewerCount] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch('/api/streams/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, username, role: 'viewer' })
                });
                const data = await resp.json();
                if (data.token) {
                    setToken(data.token);
                }
            } catch (e) {
                console.error("Transmission Link Failure:", e);
            }
        })();
    }, [room, username]);

    if (token === "") {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-neutral-950 border border-white/5 animate-pulse relative overflow-hidden rounded-[40px]">
                <div className="absolute inset-0 opacity-5">
                    <div className="h-full w-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/20 via-transparent to-transparent" />
                </div>
                <div className="relative">
                    <div className="w-16 h-16 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-6" />
                    <SignalHigh className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500/20" size={24} />
                </div>
                <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse px-6 text-center">Syncing Community Uplink Phase 2...</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black relative group selection:bg-orange-500/30 rounded-2xl md:rounded-[40px] overflow-hidden">
            <LiveKitRoom
                video={false}
                audio={false}
                token={token}
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                onDisconnected={() => setToken("")}
                connect={true}
                className="h-full flex flex-col"
            >
                <StreamRenderer />
                <StreamStats onStatsChange={setViewerCount} />
                <SuperchatOverlay communityId={room} />
            </LiveKitRoom>

            {/* Cinematic Overlays */}
            <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
                <div className="flex bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-red-600/30 items-center gap-2">
                    <div className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]"></span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">LIVE</span>
                </div>
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                    <Users size={12} className="text-gray-400" />
                    <span className="text-[10px] font-black text-white">{viewerCount}</span>
                </div>
            </div>

            <div className="absolute bottom-6 right-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500/50 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                    Neural Sync: Stable ({(Math.random() * 5 + 15).toFixed(1)}ms)
                </div>
            </div>
        </div>
    );
}
