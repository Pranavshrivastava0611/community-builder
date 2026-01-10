"use client";

import { supabase } from "@/utils/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface SuperchatEvent {
    id: string;
    username: string;
    amount: number;
    symbol: string;
    message: string;
}

export default function SuperchatOverlay({ communityId, roomId }: { communityId: string, roomId?: string }) {
    const [activeSuperchats, setActiveSuperchats] = useState<SuperchatEvent[]>([]);

    useEffect(() => {
        if (!communityId || !supabase) return;

        const channel = supabase
            .channel(`superchat-overlay-${communityId}-${roomId || 'global'}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'community_chat_messages',
                    filter: `community_id=eq.${communityId}`
                },
                (payload: any) => {
                    const msg = payload.new;
                    // Filter by roomId
                    if (roomId && msg.room_id !== roomId) return;
                    if (!roomId && msg.room_id) return;

                    if (msg.is_superchat) {
                        const newEvent: SuperchatEvent = {
                            id: msg.id,
                            username: msg.wallet.slice(0, 4) + "..." + msg.wallet.slice(-4),
                            amount: msg.superchat_amount,
                            symbol: msg.token_symbol || "SOL",
                            message: msg.message
                        };

                        setActiveSuperchats(prev => [...prev, newEvent]);

                        // Remove after 8 seconds
                        setTimeout(() => {
                            setActiveSuperchats(prev => prev.filter(sc => sc.id !== msg.id));
                        }, 8000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [communityId]);

    return (
        <div className="absolute inset-x-0 bottom-24 z-50 pointer-events-none flex flex-col items-center gap-4 px-6">
            <AnimatePresence>
                {activeSuperchats.map((sc) => (
                    <motion.div
                        key={sc.id}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -20 }}
                        className="w-full max-w-sm bg-gradient-to-r from-yellow-500/90 to-orange-600/90 backdrop-blur-md rounded-2xl p-4 shadow-[0_0_30px_rgba(234,179,8,0.4)] border border-yellow-400/50"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Zap size={18} className="text-white fill-current" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-black/60">New Hypercharge</p>
                                <p className="text-sm font-black text-white uppercase tracking-tighter">
                                    {sc.username} sent <span className="text-black">{sc.amount} {sc.symbol}</span>
                                </p>
                            </div>
                        </div>
                        {sc.message && (
                            <p className="text-xs font-bold text-white/90 italic bg-black/10 p-2 rounded-xl">
                                "{sc.message}"
                            </p>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
