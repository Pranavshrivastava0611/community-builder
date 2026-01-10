"use client";

import { supabase } from "@/utils/supabase";
import {
    LiveKitRoom,
    ParticipantTile,
    RoomAudioRenderer,
    useLocalParticipant,
    useParticipants,
    useTracks
} from "@livekit/components-react";
import "@livekit/components-styles";
import { motion } from "framer-motion";
import { Track } from "livekit-client";
import {
    Mic,
    MicOff,
    MonitorUp,
    Radio,
    Users,
    Video,
    VideoOff,
    Zap
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

function BroadcasterConference({ onEnd }: { onEnd: () => void }) {
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
    const [bitrate, setBitrate] = useState("4.2 Mbps");
    const [fps, setFps] = useState("60");

    const tracks = useTracks([
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
    ]).filter(track => track.participant.identity === localParticipant.identity);

    // Simulate metric fluctuations for professional look
    useEffect(() => {
        const interval = setInterval(() => {
            setBitrate((Math.random() * (4.8 - 4.1) + 4.1).toFixed(1) + " Mbps");
            setFps(Math.floor(Math.random() * (62 - 58) + 58).toString());
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative h-full w-full flex flex-col">
            {/* Main Preview Area */}
            <div className="flex-1 relative bg-black rounded-[40px] overflow-hidden group/preview">
                {tracks.length > 0 ? (
                    <div className="h-full w-full relative">
                        {tracks.map(t => (
                            <ParticipantTile key={`${t.source}-${t.participant.identity}`} trackRef={t} className="h-full w-full object-cover" />
                        ))}
                    </div>
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-neutral-950">
                        <div className="text-center animate-pulse">
                            <VideoOff size={48} className="text-gray-700 mx-auto mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Camera Source Offline</p>
                        </div>
                    </div>
                )}

                {/* Status Overlays */}
                <div className="absolute top-6 left-6 flex items-center gap-3">
                    <div className="bg-red-600/90 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-red-500/50">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="text-[10px] font-black tracking-widest text-white uppercase">On Air</span>
                    </div>
                </div>

                {/* Metrics Floating Panel */}
                <div className="absolute top-6 right-6 flex flex-col gap-2">
                    <div className="bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-gray-500 font-black uppercase">Bitrate</span>
                            <span className="text-[11px] text-white font-mono font-bold">{bitrate}</span>
                        </div>
                        <div className="w-[1px] h-6 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[8px] text-gray-500 font-black uppercase">FPS</span>
                            <span className="text-[11px] text-white font-mono font-bold">{fps}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Controls HUD */}
                <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 bg-black/40 backdrop-blur-3xl p-2 md:p-3 rounded-full border border-white/10 shadow-2xl transition-all hover:bg-black/60 group-hover/preview:scale-105">
                    <button
                        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isMicrophoneEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}
                    >
                        {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                    </button>

                    <button
                        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isCameraEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}
                    >
                        {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                    </button>

                    <div className="w-[1px] h-6 bg-white/10 mx-1" />

                    <button
                        onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isScreenShareEnabled ? 'bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    >
                        <MonitorUp size={18} />
                    </button>

                    <button
                        onClick={onEnd}
                        className="px-4 md:px-8 h-10 md:h-14 bg-red-600 hover:bg-red-500 text-white rounded-full font-black uppercase tracking-widest text-[8px] md:text-[10px] transition-all shadow-lg ml-1"
                    >
                        End
                    </button>
                </div>
            </div>
        </div>
    );
}

function SharedMetrics({ revenue, viewerCount }: { revenue: number; viewerCount: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 min-h-[7rem]">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-neutral-900 border border-white/5 p-5 md:p-6 rounded-[24px] md:rounded-[32px] flex flex-col justify-center gap-2 group hover:border-orange-500/30 transition-all shadow-xl"
            >
                <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Live Revenue</p>
                    <Zap size={14} className="text-yellow-500 animate-pulse" />
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-white font-black text-2xl md:text-3xl tracking-tighter">
                        {revenue.toFixed(2)}
                    </p>
                    <span className="text-gray-500 text-[10px] md:text-sm font-bold uppercase">SOL</span>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-neutral-900 border border-white/5 p-5 md:p-6 rounded-[24px] md:rounded-[32px] flex flex-col justify-center gap-2 group hover:border-blue-500/30 transition-all shadow-xl"
            >
                <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Audience</p>
                    <Users size={14} className="text-blue-500" />
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-white font-black text-2xl md:text-3xl tracking-tighter">
                        {viewerCount}
                    </p>
                    <span className="text-gray-500 text-[9px] md:text-[10px] uppercase font-bold tracking-widest">Transmitters</span>
                </div>
            </motion.div>
        </div>
    );
}

export default function BroadcasterDashboard({ room, username }: BroadcasterDashboardProps) {
    const [token, setToken] = useState("");
    const [isLive, setIsLive] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    const [revenue, setRevenue] = useState(0);
    const [streamingMode, setStreamingMode] = useState<'browser' | 'obs' | null>(null);
    const [ingressInfo, setIngressInfo] = useState<{ url: string, streamKey: string } | null>(null);

    const fetchRevenue = useCallback(async () => {
        if (!room) return;
        const { data } = await supabase
            .from('community_chat_messages')
            .select('superchat_amount')
            .eq('community_id', room)
            .eq('is_superchat', true);

        if (data) {
            const total = data.reduce((acc, curr) => acc + (curr.superchat_amount || 0), 0);
            setRevenue(total);
        }
    }, [room]);

    useEffect(() => {
        if (isLive) {
            fetchRevenue();

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
    }, [isLive, room, fetchRevenue]);

    const startOBSStream = async () => {
        try {
            const uniqueRoom = `${room}-${username}`;
            const resp = await fetch('/api/streams/ingress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: uniqueRoom,
                    streamerName: username,
                    communityId: room
                })
            });
            const data = await resp.json();
            if (data.url) {
                setIngressInfo({ url: data.url, streamKey: data.streamKey });
                setStreamingMode('obs');
                setIsLive(true);

                // Update status API
                await fetch('/api/streams/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        room: uniqueRoom,
                        status: 'live',
                        streamerId: username,
                        streamerName: username,
                        communityId: room
                    })
                });
            }
        } catch (e) {
            console.error(e);
            alert("Failed to initialize OBS link");
        }
    };

    const startStream = async () => {
        try {
            setStreamingMode('browser');
            const uniqueRoom = `${room}-${username}`;
            console.log(`Starting stream for room: ${uniqueRoom}, community: ${room}`);

            const resp = await fetch('/api/streams/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: uniqueRoom, username, role: 'streamer' })
            });
            const data = await resp.json();

            if (!data.token) throw new Error("Failed to acquire uplink token");

            setToken(data.token);
            setIsLive(true);

            const statusResp = await fetch('/api/streams/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room: uniqueRoom,
                    status: 'live',
                    streamerId: username,
                    streamerName: username,
                    communityId: room
                })
            });

            if (statusResp.ok) {
                console.log("Transmission status synced to neural directory");
            } else {
                console.error("Failed to sync status to directory");
            }
        } catch (e: any) {
            console.error("Uplink failure:", e);
            alert("Transmission Error: " + (e.message || "Unknown Failure"));
        }
    };

    const endStream = async () => {
        const uniqueRoom = `${room}-${username}`;
        setToken("");
        setIsLive(false);
        setStreamingMode(null);
        setIngressInfo(null);
        await fetch('/api/streams/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: uniqueRoom, status: 'idle', communityId: room })
        });
    };

    if (!isLive) {
        return (
            <div className="relative group overflow-hidden h-full min-h-[450px] md:min-h-[550px] flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 to-rose-600/10 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="h-full flex flex-col items-center justify-center p-6 md:p-12 bg-neutral-950 border border-white/5 rounded-[24px] md:rounded-[48px] text-center space-y-8 md:space-y-10 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-orange-500/20 blur-[30px] rounded-full" />
                        <div className="w-20 h-20 md:w-32 md:h-32 bg-orange-500/10 rounded-[20px] md:rounded-[40px] flex items-center justify-center mx-auto mb-4 md:mb-8 border border-orange-500/20 shadow-2xl relative z-10 group-hover:rotate-12 transition-transform duration-500">
                            <Radio className="w-8 h-8 md:w-12 md:h-12 text-orange-500" />
                        </div>
                    </div>
                    <div className="max-w-md">
                        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white mb-3 md:mb-4">Transmission</h2>
                        <p className="text-gray-500 text-[9px] md:text-[11px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] leading-relaxed px-4">
                            Select broadcast methodology. Browser sync or professional OBS uplink.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-2 md:px-4">
                        <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[24px] md:rounded-[32px] hover:border-orange-500/30 transition-all flex flex-col justify-between group/opt">
                            <div className="text-left mb-4 md:mb-6">
                                <h3 className="text-white font-black uppercase tracking-widest text-[12px] md:text-sm mb-1 md:mb-2">Studio Sync</h3>
                                <p className="text-gray-500 text-[8px] uppercase font-bold tracking-widest">WebRTC Direct</p>
                            </div>
                            <GlowButton onClick={startStream} className="w-full py-3 md:py-4 text-[9px] md:text-[10px] bg-white text-black hover:bg-orange-500 hover:text-white transition-colors">
                                Uplink Now
                            </GlowButton>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[24px] md:rounded-[32px] hover:border-blue-500/30 transition-all flex flex-col justify-between group/opt">
                            <div className="text-left mb-4 md:mb-6">
                                <h3 className="text-white font-black uppercase tracking-widest text-[12px] md:text-sm mb-1 md:mb-2">OBS Meta</h3>
                                <p className="text-gray-500 text-[8px] uppercase font-bold tracking-widest">RTMP Professional</p>
                            </div>
                            <GlowButton onClick={startOBSStream} className="w-full py-3 md:py-4 text-[9px] md:text-[10px] bg-blue-600 border-none hover:shadow-blue-600/40 text-white">
                                Get Keys
                            </GlowButton>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (streamingMode === 'obs' && ingressInfo) {
        return (
            <div className="space-y-6 flex flex-col h-full animate-in zoom-in-95 duration-500">
                <div className="relative flex-1 bg-neutral-900 rounded-[24px] md:rounded-[48px] p-6 md:p-12 overflow-hidden border border-white/5 shadow-2xl flex flex-col items-center justify-center text-center">
                    <div className="md:absolute md:top-8 md:left-8 flex items-center justify-center gap-3 mb-8 md:mb-0">
                        <div className="bg-blue-600 px-4 py-2 rounded-xl flex items-center gap-2 border border-blue-400/30">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-black tracking-widest text-white uppercase">RTMP LINK ACTIVE</span>
                        </div>
                    </div>

                    <div className="max-w-xl w-full space-y-6 md:space-y-8">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter mb-2">Neural Uplink</h2>
                            <p className="text-gray-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest">Transfer these credentials into OBS</p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl text-left">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Server URL</p>
                                    <button onClick={() => { navigator.clipboard.writeText(ingressInfo.url); alert("URL Copied"); }} className="text-[8px] text-blue-500 font-black uppercase">Copy</button>
                                </div>
                                <code className="text-orange-400 text-[10px] md:text-xs font-mono break-all line-clamp-2 md:line-clamp-1">{ingressInfo.url}</code>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl text-left relative group/key">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Stream Key</p>
                                    <button onClick={() => { navigator.clipboard.writeText(ingressInfo.streamKey); alert("Key Copied"); }} className="text-[8px] text-blue-500 font-black uppercase">Copy</button>
                                </div>
                                <code className="text-orange-400 text-[10px] md:text-xs font-mono break-all">{ingressInfo.streamKey}</code>
                                <div className="absolute inset-0 bg-neutral-900 rounded-2xl md:rounded-3xl flex items-center justify-center group-hover/key:opacity-0 transition-opacity cursor-pointer border border-white/5">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Touch to reveal key</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 md:pt-8">
                            <button
                                onClick={endStream}
                                className="w-full md:w-auto px-12 py-4 md:py-5 bg-red-600 hover:bg-red-500 text-white rounded-2xl md:rounded-3xl font-black uppercase tracking-widest text-[10px] transition-all"
                            >
                                Terminate Session
                            </button>
                        </div>
                    </div>
                </div>

                <SharedMetrics revenue={revenue} viewerCount={viewerCount} />
            </div>
        );
    }

    const uniqueRoom = `${room}-${username}`;

    return (
        <div className="space-y-4 md:space-y-6 flex flex-col h-full animate-in fade-in duration-700">
            <div className="relative flex-1 bg-black rounded-[24px] md:rounded-[48px] overflow-hidden border border-white/5 shadow-2xl">
                <LiveKitRoom
                    video={true}
                    audio={true}
                    token={token}
                    serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                    onDisconnected={endStream}
                    connect={true}
                    className="h-full"
                >
                    <BroadcasterConference onEnd={endStream} />
                    <RoomAudioRenderer />
                    <StreamStats onStatsChange={setViewerCount} />
                    <SuperchatOverlay communityId={room} roomId={uniqueRoom} />
                </LiveKitRoom>
            </div>

            <SharedMetrics revenue={revenue} viewerCount={viewerCount} />
        </div>
    );
}
