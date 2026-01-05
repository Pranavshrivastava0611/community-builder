"use client";

import { supabase } from "@/utils/supabase";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import GlowButton from "./GlowButton";
import SuperchatModal from "./SuperchatModal";

interface Message {
    id: string;
    user_id: string;
    wallet: string;
    message: string;
    created_at: string;
    type: "text" | "image" | "system";
    is_superchat?: boolean;
    superchat_amount?: number;
    tx_signature?: string;
    user?: {
        username?: string;
        avatar_url?: string;
    };
}

interface CommunityChatProps {
    communityId: string;
    currentWallet?: string;
    isMember: boolean;
    recipientWallet?: string;
}

export default function CommunityChat({ communityId, currentWallet, isMember, recipientWallet }: CommunityChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [realtimeStatus, setRealtimeStatus] = useState<string>("connecting");
    const [isSuperchatOpen, setIsSuperchatOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pendingFetchIds = useRef<Set<string>>(new Set());
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Fetch History
    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/chat/${communityId}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.messages) {
                setMessages(data.messages);
                scrollToBottom();
            }
        } catch (e) {
            console.error("Failed to load chat history", e);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [communityId]);

    // 2. Realtime Event Batching & Profile Enrichment
    const batchFetchMessages = async () => {
        const ids = Array.from(pendingFetchIds.current);
        if (ids.length === 0) return;
        pendingFetchIds.current.clear();

        try {
            const { data, error } = await supabase
                .from('community_chat_messages')
                .select('*, user:profiles(username, avatar_url)')
                .in('id', ids);

            if (data && !error) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const incomingMessages = data.map(m => ({
                        ...m,
                        user: Array.isArray(m.user) ? m.user[0] : m.user
                    }));

                    const newUnique = incomingMessages.filter(m => !existingIds.has(m.id));

                    // Cleanup optimistic messages
                    const incomingContents = new Set(incomingMessages.map(m => m.message));
                    const filteredPrev = prev.filter(m =>
                        !m.id.startsWith('temp-') || !incomingContents.has(m.message)
                    );

                    return [...filteredPrev, ...newUnique].sort((a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                });
                scrollToBottom();
            }
        } catch (err) {
            console.error("Batch fetch error:", err);
        }
    };

    const triggerBatchFetch = (idList: string[]) => {
        idList.forEach(id => pendingFetchIds.current.add(id));
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(batchFetchMessages, 200);
    };

    useEffect(() => {
        if (!supabase) return;

        const channel = supabase
            .channel(`room:${communityId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "community_chat_messages",
                    // We remove the filter property for better cross-device reliability
                },
                (payload: any) => {
                    // Manual filter check
                    if (payload.new && payload.new.community_id === communityId) {
                        triggerBatchFetch([payload.new.id]);
                    }
                }
            )
            .on("broadcast", { event: "new-batch" }, (payload: any) => {
                console.log("Broadcast received:", payload);
                if (payload.payload?.messages) {
                    const ids = payload.payload.messages.map((m: any) => m.id);
                    triggerBatchFetch(ids);
                }
            })
            .subscribe((status) => {
                setRealtimeStatus(status);
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    // Fallback to manual refresh
                    setTimeout(fetchHistory, 5000);
                }
            });

        return () => {
            supabase.removeChannel(channel);
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        };
    }, [communityId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    // 3. Batched Sending Logic
    const [messageBuffer, setMessageBuffer] = useState<string[]>([]);
    const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const flushBuffer = async (messagesToFlush: string[]) => {
        if (messagesToFlush.length === 0) return;
        setSending(true);

        try {
            const token = localStorage.getItem("authToken");
            if (!token) throw new Error("Auth required");

            const res = await fetch("/api/chat/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    communityId,
                    messages: messagesToFlush,
                    type: "text",
                    is_superchat: false
                })
            });

            if (!res.ok) throw new Error("Batch send failed");

            const data = await res.json();
            if (data.messages) {
                setMessages((prev) => {
                    const filtered = prev.filter(m => !m.id.startsWith('temp-'));
                    const existingIds = new Set(filtered.map(m => m.id));
                    const newUnique = data.messages.filter((m: any) => !existingIds.has(m.id));
                    return [...filtered, ...newUnique].sort((a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                });
                scrollToBottom();
            }

        } catch (error) {
            console.error("Chat batch send error:", error);
            toast.error("Some messages failed to send");
        } finally {
            setSending(false);
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !isMember) return;

        const currentMsg = newMessage.trim();
        setNewMessage("");

        const optimisticMsg: Message = {
            id: `temp-${Date.now()}`,
            user_id: "me",
            wallet: currentWallet || "me",
            message: currentMsg,
            created_at: new Date().toISOString(),
            type: "text"
        };
        setMessages(prev => [...prev, optimisticMsg]);
        scrollToBottom();

        setMessageBuffer(prev => {
            const newBuffer = [...prev, currentMsg];
            if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
            bufferTimeoutRef.current = setTimeout(() => {
                flushBuffer(newBuffer);
                setMessageBuffer([]);
                bufferTimeoutRef.current = null;
            }, 800);
            return newBuffer;
        });
    };

    return (
        <div className="flex flex-col h-[600px] bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md relative">
            {/* Realtime Status Banner */}
            {realtimeStatus !== 'SUBSCRIBED' && (
                <div className="absolute top-14 left-0 right-0 py-1 bg-orange-500/20 text-orange-500 text-[9px] font-black uppercase tracking-widest text-center z-10 animate-pulse border-b border-orange-500/30">
                    Syncing with Chain... ({realtimeStatus})
                </div>
            )}

            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <h3 className="font-bold text-white tracking-wide flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'} animate-pulse`}></span>
                    Community Pulse
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-mono">#{communityId.slice(0, 6)}</span>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {messages.map((msg, idx) => {
                    const isOwn = currentWallet === msg.wallet || msg.user_id === "me";
                    const isSuper = msg.is_superchat;

                    return (
                        <div key={msg.id || idx} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                            {isSuper && (
                                <div className="flex items-center gap-2 mb-1 px-2">
                                    <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                                        <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Superchat • {msg.superchat_amount} SOL</span>
                                </div>
                            )}
                            <div className={`flex ${isOwn ? "justify-end" : "justify-start"} w-full`}>
                                <div className={`max-w-[85%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm transition-all ${isSuper
                                        ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/40 text-white font-bold ring-4 ring-yellow-500/5"
                                        : isOwn
                                            ? "bg-orange-600/20 border border-orange-500/30 text-white rounded-tr-sm"
                                            : "bg-white/10 border border-white/5 text-gray-200 rounded-tl-sm"
                                        }`}>
                                        {msg.message}
                                    </div>
                                    <div className="mt-1 text-[9px] text-gray-600 font-mono px-1 flex gap-2">
                                        <span className={isOwn ? "text-orange-400/50" : "text-gray-500"}>
                                            {msg.user?.username || (msg.wallet ? `${msg.wallet.slice(0, 4)}...${msg.wallet.slice(-4)}` : "Anonym")}
                                        </span>
                                        <span suppressHydrationWarning className="opacity-50">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-white/5">
                {!isMember ? (
                    <div className="text-center text-gray-500 text-xs py-2 bg-white/5 rounded-xl border border-white/5 border-dashed">
                        Verify membership to transmit signals.
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/30 transition-all shadow-inner"
                            disabled={sending}
                        />
                        <GlowButton type="submit" disabled={sending || !newMessage.trim()} className="px-5 py-2.5 text-xs">
                            Send
                        </GlowButton>
                        <button
                            type="button"
                            onClick={() => setIsSuperchatOpen(true)}
                            className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-500 hover:bg-yellow-500/20 transition-all shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>

            <SuperchatModal
                isOpen={isSuperchatOpen}
                onClose={() => setIsSuperchatOpen(false)}
                communityId={communityId}
                recipientWallet={recipientWallet || ""}
            />
        </div>
    );
}
