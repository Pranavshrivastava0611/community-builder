"use client";

import Navbar from "@/components/Navbar";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Radio, Shield, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Stream {
    room_name: string;
    streamer_name: string;
    community_id: string;
    status: string;
    updated_at: string;
    community: {
        id: string;
        name: string;
        image_url: string;
        token_symbol: string;
    };
}

function LiveStreamCard({ stream }: { stream: Stream }) {
    return (
        <Link
            href={`/communities/${encodeURIComponent(stream.community.name)}/live?room=${encodeURIComponent(stream.room_name)}`}
            className="group block h-full"
        >
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                className="relative h-full min-h-[340px] rounded-[40px] overflow-hidden border border-white/5 bg-neutral-950 shadow-2xl transition-all hover:border-orange-500/50 flex flex-col"
            >
                {/* Visual Background / Preview */}
                <div className="relative aspect-video overflow-hidden">
                    <img
                        src={stream.community.image_url}
                        alt={stream.community.name}
                        className="w-full h-full object-cover opacity-40 group-hover:scale-110 group-hover:opacity-60 transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

                    {/* Live Indicators */}
                    <div className="absolute top-6 left-6 flex items-center gap-3">
                        <div className="bg-red-600 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 border border-red-500/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-white">Live Signal</span>
                        </div>
                        <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                            <Radio size={12} className="text-orange-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sector {stream.room_name.slice(-2)}</span>
                        </div>
                    </div>

                    {/* Community Badge */}
                    <div className="absolute bottom-4 left-6">
                        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                            <div className="w-4 h-4 rounded-full overflow-hidden border border-white/20">
                                <img src={stream.community.image_url} className="w-full h-full object-cover" />
                            </div>
                            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">{stream.community.name}</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 flex-1 flex flex-col justify-between">
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter text-white group-hover:text-orange-400 transition-colors mb-2">
                            {stream.streamer_name || "Nexus Director"}
                        </h3>
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] italic">
                            Originating from Neural Node {stream.community.id.slice(0, 4)}
                        </p>
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-gray-600 font-black uppercase">Sync Rate</span>
                                <div className="flex items-center gap-2">
                                    <Users size={12} className="text-blue-500" />
                                    <span className="text-xs font-black text-white">Active</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-gray-600 font-black uppercase">Gas Fee</span>
                                <div className="flex items-center gap-2">
                                    <Zap size={12} className="text-yellow-500" />
                                    <span className="text-xs font-black text-white">{stream.community.token_symbol}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-10 h-10 rounded-full border border-orange-500/20 flex items-center justify-center group-hover:bg-orange-500 transition-all">
                            <svg className="w-4 h-4 text-orange-500 group-hover:text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}

export default function LiveDirectoryPage() {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStreams() {
            try {
                const res = await fetch("/api/streams/active");
                const data = await res.json();
                setStreams(data.streams || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchStreams();
    }, []);

    return (
        <div className="min-h-screen bg-black text-white selection:bg-orange-500/30 font-sans">
            <Navbar />

            <main className="max-w-[1600px] mx-auto px-6 md:px-12 pt-16 pb-32">
                <header className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="max-w-3xl">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4 mb-4"
                        >
                            <div className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]"></span>
                            </div>
                            <span className="text-red-500 text-[10px] font-black uppercase tracking-[0.4em]">Global Transmission Network</span>
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none"
                        >
                            Active <span className="text-orange-500">Links</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-gray-500 font-medium max-w-xl mt-8 text-lg leading-relaxed"
                        >
                            Real-time neural broadcasts across all verified sectors. Deploying multi-threaded community synchronization via high-frequency uplinks.
                        </motion.p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Global Load</span>
                            <div className="flex items-center gap-2">
                                <Activity className="text-green-500 w-4 h-4" />
                                <span className="text-2xl font-black text-white">4.2 TB/S</span>
                            </div>
                        </div>
                        <div className="w-[1px] h-12 bg-white/10 hidden md:block" />
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Secure Nodes</span>
                            <div className="flex items-center gap-2">
                                <Shield className="text-blue-500 w-4 h-4" />
                                <span className="text-2xl font-black text-white">12,042</span>
                            </div>
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="min-h-[340px] bg-white/[0.03] rounded-[40px] animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : streams.length === 0 ? (
                    <div className="h-[500px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-[60px] bg-white/[0.01] backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Radio size={56} className="text-white/10 mb-8" />
                        <h3 className="text-3xl font-black text-gray-400 uppercase tracking-tighter">No signals detected</h3>
                        <p className="text-gray-600 text-sm mt-4 font-bold uppercase tracking-widest">Waiting for community directors to establish link...</p>
                        <Link href="/communities" className="mt-12">
                            <button className="px-10 py-5 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-2xl">
                                Become a Director
                            </button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        <AnimatePresence mode="popLayout">
                            {streams.map((stream, idx) => (
                                <motion.div
                                    key={stream.room_name}
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    layout
                                >
                                    <LiveStreamCard stream={stream} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                <section className="mt-40">
                    <div className="relative group p-1 flex items-center justify-center rounded-[60px] bg-gradient-to-r from-orange-500/20 via-rose-500/20 to-blue-500/20 border border-white/5 overflow-hidden">
                        <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-3xl" />

                        <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-12 p-16 md:p-24">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <Radio className="text-orange-500 w-6 h-6" />
                                    <span className="text-orange-500 font-black uppercase tracking-[0.4em] text-xs">Director Recruitment</span>
                                </div>
                                <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight mb-8 text-white">
                                    Start Your Own <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500 italic">Neural Channel</span>
                                </h2>
                                <p className="text-gray-500 text-lg font-medium leading-relaxed mb-12">
                                    Establish your presence. Manage high-frequency synchronization, monetize via neural Superchats, and govern your community in real-time.
                                </p>
                                <div className="flex flex-wrap gap-6">
                                    <Link href="/communities">
                                        <button className="px-10 py-5 bg-orange-600 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-orange-500 transition-all shadow-xl shadow-orange-600/20">
                                            Establish Sector
                                        </button>
                                    </Link>
                                    <button className="px-10 py-5 bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                                        View Documentation
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="w-64 h-64 rounded-full border border-orange-500/20 flex items-center justify-center animate-spin-slow">
                                    <div className="w-48 h-48 rounded-full border border-orange-500/10 flex items-center justify-center">
                                        <div className="w-32 h-32 rounded-full border border-orange-500/5 flex items-center justify-center">
                                            <Globe size={48} className="text-orange-500 animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute inset-0 bg-orange-500/20 blur-[100px] rounded-full -z-10" />
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

function Activity({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    )
}
