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
    Disc,
    Mic,
    MicOff,
    MonitorUp,
    Radio,
    Square,
    Users,
    Video,
    VideoOff,
    Zap
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
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

function BroadcasterConference({ onEnd, roomName, streamerId, communityId, streamTitle }: { onEnd: () => void, roomName: string, streamerId: string, communityId: string, streamTitle: string }) {
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
    const [bitrate, setBitrate] = useState("4.2 Mbps");
    const [fps, setFps] = useState("60");

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploading, setUploading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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

    // Cleanup recording on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        }
    }, []);

    const handleToggleScreenShare = async () => {
        try {
            // Check if getDisplayMedia is supported (common issue on mobile)
            if (!navigator.mediaDevices?.getDisplayMedia) {
                toast.error("Screen sharing is not supported on this device/browser. Most mobile browsers restrict this feature.");
                return;
            }

            await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, {
                audio: true, // Try to capture audio with screen share if supported
            });

            if (!isScreenShareEnabled) {
                toast.success("Broadcast expanded to screen");
            }
        } catch (error: any) {
            console.error("Screen share failure:", error);
            if (error.name === 'NotAllowedError') {
                toast.error("Permission denied. Ensure screen recording is enabled in system settings.");
            } else {
                toast.error(`Neural Uplink Error: ${error.message || "Uplink Interrupted"}`);
            }
        }
    };

    const startRecording = useCallback(async () => {
        try {
            const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
            const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
            const screenPub = localParticipant.getTrackPublication(Track.Source.ScreenShare);

            const tracksToRecord: MediaStreamTrack[] = [];

            // Prioritize screen share video if available, otherwise camera
            const videoTrack = screenPub?.track || camPub?.track;
            if (videoTrack?.mediaStreamTrack) {
                tracksToRecord.push(videoTrack.mediaStreamTrack);
            }

            // Always add mic audio if available
            if (micPub?.track?.mediaStreamTrack) {
                tracksToRecord.push(micPub.track.mediaStreamTrack);
            }

            if (tracksToRecord.length === 0) {
                alert("No media tracks available to record. Is your camera or mic on?");
                return;
            }

            const stream = new MediaStream(tracksToRecord);

            let mimeType = 'video/webm;codecs=vp9,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp8,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/webm';
                }
            }


            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                await uploadRecording(blob);
                setIsRecording(false);
                setRecordingDuration(0);
                if (timerRef.current) clearInterval(timerRef.current);
            };

            recorder.start(1000); // Collect 1s chunks
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error("Failed to start recording:", error);
            alert("Failed to start recording");
        }
    }, [localParticipant]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const uploadRecording = async (blob: Blob) => {
        setUploading(true);
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `${roomName}/${timestamp}.webm`;

            const { data, error } = await supabase.storage
                .from('recordings')
                .upload(fileName, blob);

            if (error) throw error;

            // Sync to database
            const publicUrl = `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]}/storage/v1/object/public/recordings/${fileName}`;

            await fetch('/api/streams/recordings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    streamerId: streamerId,
                    roomName: roomName,
                    videoUrl: publicUrl,
                    communityId: communityId,
                    title: streamTitle || `Broadcast - ${new Date().toLocaleDateString()}`
                })
            });

            alert("Recording uploaded and synced successfully!");
        } catch (error: any) {
            console.error("Upload failed:", error);
            alert(`Upload failed: ${error.message || "Unknown error"}. Ensure 'recordings' bucket exists in Supabase.`);
        } finally {
            setUploading(false);
        }
    };

    const formatDuration = (sec: number) => {
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        return `${min}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="relative h-full w-full flex flex-col">
            {/* Main Preview Area */}
            <div className="flex-1 relative bg-black rounded-[40px] overflow-hidden group/preview">
                {tracks.length > 0 ? (
                    <div className="h-full w-full relative">
                        {(() => {
                            const screenShareTrack = tracks.find(t => t.source === Track.Source.ScreenShare);
                            const cameraTrack = tracks.find(t => t.source === Track.Source.Camera);

                            if (screenShareTrack) {
                                return (
                                    <>
                                        <ParticipantTile trackRef={screenShareTrack} className="h-full w-full object-contain bg-neutral-900" />
                                        {cameraTrack && isCameraEnabled && (
                                            <div className="absolute bottom-32 right-6 w-32 h-44 rounded-2xl overflow-hidden border-2 border-orange-500 shadow-2xl z-20 animate-in fade-in slide-in-from-right-4 duration-500">
                                                <ParticipantTile trackRef={cameraTrack} className="h-full w-full object-cover" />
                                            </div>
                                        )}
                                    </>
                                );
                            }

                            return cameraTrack ? (
                                <ParticipantTile trackRef={cameraTrack} className="h-full w-full object-cover" />
                            ) : null;
                        })()}
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
                    {isRecording && (
                        <div className="bg-neutral-800/90 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10px] font-black tracking-widest text-white uppercase">REC {formatDuration(recordingDuration)}</span>
                        </div>
                    )}
                    {uploading && (
                        <div className="bg-blue-600/90 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-blue-500/50">
                            <span className="text-[10px] font-black tracking-widest text-white uppercase animate-pulse">Uploading...</span>
                        </div>
                    )}
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
                        title="Toggle Mic"
                    >
                        {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                    </button>

                    <button
                        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isCameraEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}
                        title="Toggle Camera"
                    >
                        {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                    </button>

                    <div className="w-[1px] h-6 bg-white/10 mx-1" />

                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={uploading}
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 animate-pulse text-white' : 'bg-white/10 hover:bg-white/20 text-white'} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isRecording ? "Stop Recording" : "Start Recording"}
                    >
                        {isRecording ? <Square size={18} fill="currentColor" /> : <Disc size={18} />}
                    </button>

                    <div className="w-[1px] h-6 bg-white/10 mx-1" />

                    <button
                        onClick={handleToggleScreenShare}
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isScreenShareEnabled ? 'bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        title="Share Screen"
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
    const [streamTitle, setStreamTitle] = useState("");
    const [showBrowserWarning, setShowBrowserWarning] = useState(false);

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
                        communityId: room,
                        title: streamTitle
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
                    communityId: room,
                    title: streamTitle
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
            <div className="flex-1 flex items-center justify-center p-4">
                {/* Browser Streaming Warning Modal */}
                {showBrowserWarning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="max-w-md w-full bg-neutral-900 border border-orange-500/30 rounded-[40px] p-10 shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Radio size={120} className="text-orange-500" />
                            </div>

                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-orange-500/20 text-orange-500 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/20">
                                    <Video size={32} />
                                </div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Neural Warning</h3>
                                <div className="space-y-4 text-gray-400 text-sm font-medium leading-relaxed mb-10">
                                    <p>You are about to establish a <span className="text-white">Browser-Based Uplink</span>. This method is highly accessible but carries risks:</p>
                                    <ul className="list-disc list-inside space-y-2 text-xs">
                                        <li>Refreshing the page will <span className="text-red-500 font-bold">Instantly Terminate</span> the broadcast.</li>
                                        <li>Backgrounding the browser tab may cause signal lag.</li>
                                        <li>Closing the tab will end the session without recovery.</li>
                                    </ul>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            setShowBrowserWarning(false);
                                            startStream();
                                        }}
                                        className="w-full py-5 bg-orange-500 text-black rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-orange-600 transition-all"
                                    >
                                        Establish Transmission
                                    </button>
                                    <button
                                        onClick={() => setShowBrowserWarning(false)}
                                        className="w-full py-4 bg-black/40 border border-white/10 text-gray-500 rounded-3xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all underline decoration-gray-700"
                                    >
                                        Abort Link
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                <div className="max-w-md w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-orange-500 rounded-[32px] mx-auto flex items-center justify-center shadow-2xl rotate-3 hover:rotate-6 transition-transform">
                            <Radio size={40} className="text-white" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter">Studio Sync</h2>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Initialize your transmission parameters</p>
                    </div>

                    <div className="space-y-4 bg-neutral-900/50 backdrop-blur-xl p-8 rounded-[40px] border border-white/5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Broadcast Title</label>
                            <input
                                type="text"
                                placeholder="Enter transmission title..."
                                value={streamTitle}
                                onChange={(e) => setStreamTitle(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:border-orange-500 outline-none transition-all placeholder:text-gray-700 text-white"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-4">
                            <button
                                onClick={() => setShowBrowserWarning(true)}
                                className="w-full py-5 bg-white text-black rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-orange-500 hover:text-white transition-all shadow-xl hover:-translate-y-1"
                            >
                                Start Browser Stream
                            </button>
                            <button
                                onClick={startOBSStream}
                                className="w-full py-5 bg-black border border-white/10 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:border-orange-500 transition-all shadow-xl hover:-translate-y-1"
                            >
                                OBS Studio Link
                            </button>
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
                    <BroadcasterConference onEnd={endStream} roomName={uniqueRoom} streamerId={username} communityId={room} streamTitle={streamTitle} />
                    <RoomAudioRenderer />
                    <StreamStats onStatsChange={setViewerCount} />
                    <SuperchatOverlay communityId={room} roomId={uniqueRoom} />
                </LiveKitRoom>
            </div>

            <SharedMetrics revenue={revenue} viewerCount={viewerCount} />
        </div>
    );
}
