"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import GlassPanel from "./GlassPanel";

interface Holder {
    address: string;
    amount: number;
    user: {
        id?: string;
        username: string;
        avatar_url?: string;
    }
}

export default function HoldersLeaderboard({ communityId }: { communityId: string }) {
    const [holders, setHolders] = useState<Holder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHolders() {
            try {
                const res = await fetch(`/api/communities/id/${communityId}/holders`);
                const data = await res.json();
                if (data.holders) setHolders(data.holders);
            } catch (e) {
                console.error("Holders fetch failed", e);
            } finally {
                setLoading(false);
            }
        }
        fetchHolders();
    }, [communityId]);

    if (loading) return (
        <GlassPanel className="p-6 rounded-2xl border border-white/10 bg-white/5 animate-pulse">
            <div className="h-4 w-32 bg-white/10 rounded mb-4" />
            <div className="space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10" />
                        <div className="flex-1 h-3 bg-white/10 rounded" />
                    </div>
                ))}
            </div>
        </GlassPanel>
    );

    if (holders.length === 0) return null;

    return (
        <GlassPanel className="p-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[50px] rounded-full" />

            <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                Top Alphas
            </h3>

            <div className="space-y-4">
                {(holders || []).map((holder, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img
                                    src={holder.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${holder.user?.username}`}
                                    className="w-10 h-10 rounded-full border border-white/10 object-cover"
                                    alt=""
                                />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full border border-white/10 flex items-center justify-center text-[8px] font-black text-white">
                                    {idx + 1}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white group-hover:text-orange-400 transition-colors truncate max-w-[100px]">
                                    {holder.user?.username}
                                </h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                                    Transmitter
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-black text-orange-400">
                                {holder.amount.toLocaleString()}
                            </div>
                            <div className="text-[8px] font-black text-gray-700 uppercase tracking-tighter">
                                Staked Assets
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-700 text-center">
                    Values synced with Solana Mainnet Matrix
                </p>
            </div>
        </GlassPanel>
    );
}
