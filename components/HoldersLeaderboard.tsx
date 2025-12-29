"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import GlassPanel from "./GlassPanel";

interface Holder {
    address: string;
    amount: number;
    user: {
        id?: string;
        username: string;
        avatar_url?: string;
        communityRole?: string;
    }
}

const getTier = (amount: number) => {
    if (amount >= 1000000) return { label: "Whale", color: "text-blue-400" };
    if (amount >= 100000) return { label: "Shark", color: "text-red-400" };
    if (amount >= 10000) return { label: "Dolphin", color: "text-cyan-400" };
    if (amount >= 1000) return { label: "Crab", color: "text-orange-400" };
    return { label: "Shrimp", color: "text-gray-500" };
};

export default function HoldersLeaderboard({
    communityId,
    creatorId,
    currentUserId
}: {
    communityId: string;
    creatorId?: string;
    currentUserId?: string;
}) {
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

    const handlePromote = async (holderId: string) => {
        if (!holderId) return;
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch(`/api/communities/id/${communityId}/promote`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetProfileId: holderId, role: 'moderator' })
            });
            if (res.ok) {
                toast.success("Alpha promoted to Moderator!");
                // refresh...
                const updatedRes = await fetch(`/api/communities/id/${communityId}/holders`);
                const updatedData = await updatedRes.json();
                if (updatedData.holders) setHolders(updatedData.holders);
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to promote");
            }
        } catch (e) {
            toast.error("Network error during promotion");
        }
    };

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

    const isCreator = currentUserId === creatorId;

    return (
        <GlassPanel className="p-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[50px] rounded-full" />

            <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                Top Alphas
            </h3>

            <div className="space-y-5">
                {(holders || []).map((holder, idx) => {
                    const tier = getTier(holder.amount);
                    const dbRole = holder.user?.communityRole || (idx === 0 ? "Top Holder" : "Alpha");
                    const canPromote = isCreator && holder.user?.id && holder.user.id !== currentUserId && dbRole !== 'moderator';

                    return (
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
                                        className="w-10 h-10 rounded-full border-2 border-white/5 object-cover"
                                        alt=""
                                    />
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full border border-white/10 flex items-center justify-center text-[10px] font-black ${tier.color}`}>
                                        {tier.label[0]}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm font-black text-white group-hover:text-orange-400 transition-colors truncate max-w-[100px] flex items-center gap-1">
                                        {holder.user?.username}
                                        {dbRole === 'moderator' && <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" title="Moderator" />}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${tier.color}`}>
                                            {tier.label}
                                        </span>
                                        <span className="text-[8px] text-gray-600 font-black uppercase tracking-tighter">
                                            {dbRole}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-right">
                                    <div className="text-sm font-black text-orange-400">
                                        {holder.amount >= 1000 ? (holder.amount / 1000).toFixed(1) + "k" : holder.amount.toLocaleString()}
                                    </div>
                                    <div className="text-[7px] font-black text-gray-700 uppercase tracking-tighter">
                                        Assets
                                    </div>
                                </div>
                                {canPromote && (
                                    <button
                                        onClick={() => handlePromote(holder.user!.id!)}
                                        className="text-[9px] font-black text-blue-500 hover:text-white uppercase tracking-widest border border-blue-500/30 px-2 py-0.5 rounded-md hover:bg-blue-500/20 transition-all"
                                    >
                                        Mod+
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-700 text-center">
                    Values synced with Solana Mainnet Matrix
                </p>
            </div>
        </GlassPanel>
    );
}
