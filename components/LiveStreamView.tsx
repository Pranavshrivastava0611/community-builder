"use client";

import {
    LiveKitRoom,
    RoomAudioRenderer,
    VideoConference
} from "@livekit/components-react";
import "@livekit/components-styles";
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
                const resp = await fetch(
                    `/api/streams/token?room=${room}&username=${username}`
                );
                const data = await resp.json();
                setToken(data.token);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [room, username]);

    if (token === "") {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-black/40 border border-white/10 rounded-3xl animate-pulse">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Connecting to Stream...</p>
            </div>
        );
    }

    return (
        <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
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

            {/* Live Badge Overlay */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </span>
                <span className="bg-red-600 text-[10px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow-lg">Live</span>
            </div>
        </div>
    );
}
