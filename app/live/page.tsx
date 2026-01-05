"use client";

import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { SignalHigh, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Stream {
    community_id: string;
    status: string;
    community: {
        id: string;
        name: string;
        image_url: string;
        token_symbol: string;
    };
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
        <div className="min-h-screen bg-black text-white selection:bg-orange-500/30">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 md:px-10 pt-12 pb-20">
                <header className="mb-12">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                        </div>
                        <span className="text-red-500 text-xs font-black uppercase tracking-[0.2em]">Transmission Hub</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Live Sectors</h1>
                    <p className="text-gray-500 font-medium max-w-2xl mt-4">
                        Real-time transmissions across the ecosystem. Sync with community directors and participate in live synthetic growth.
                    </p>
                </header>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="aspect-video bg-white/5 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : streams.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                        <SignalHigh size={48} className="text-white/10 mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">No active transmissions detected</h3>
                        <p className="text-gray-600 text-sm mt-2">Check back later or start your own link.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {streams.map((stream) => (
                            <Link
                                key={stream.community_id}
                                href={`/communities/${encodeURIComponent(stream.community.name)}/live`}
                                className="group"
                            >
                                <motion.div
                                    whileHover={{ y: -5 }}
                                    className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl transition-all group-hover:border-orange-500/50"
                                >
                                    <img
                                        src={stream.community.image_url}
                                        alt={stream.community.name}
                                        className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                                        <span className="bg-red-600 text-[9px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow-lg">Live</span>
                                    </div>

                                    <div className="absolute bottom-4 left-4 right-4 text-white">
                                        <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-orange-400 transition-colors">
                                            {stream.community.name}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1 opacity-60 text-[10px] font-bold uppercase tracking-widest">
                                            <span className="flex items-center gap-1">
                                                <Users size={12} /> Live Sync
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Zap size={12} className="text-yellow-500" /> {stream.community.token_symbol}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                )}

                <section className="mt-24 pt-20 border-t border-white/5">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-gradient-to-br from-orange-500/10 to-rose-500/10 p-12 rounded-[40px] border border-orange-500/20 relative overflow-hidden">
                        <div className="relative z-10 max-w-lg">
                            <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Start Your Own Link</h2>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Establish your community's presence. Direct high-frequency signals, manage your audience, and monetize via neural Superchats.
                            </p>
                            <Link href="/communities">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    className="mt-8 px-8 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-colors"
                                >
                                    Establish Sector
                                </motion.button>
                            </Link>
                        </div>
                        <div className="relative z-10">
                            <div className="w-32 h-32 rounded-full border border-orange-500/50 flex items-center justify-center animate-pulse">
                                <div className="w-24 h-24 rounded-full border border-orange-500/10 flex items-center justify-center">
                                    <SignalHigh size={40} className="text-orange-500" />
                                </div>
                            </div>
                        </div>
                        {/* Abstract background flare */}
                        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-orange-500/20 rounded-full blur-[100px]" />
                    </div>
                </section>
            </main>
        </div>
    );
}
