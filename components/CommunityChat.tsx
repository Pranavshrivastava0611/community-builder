"use client";

import { supabase } from "@/utils/supabase";
import { ChevronDown, Filter, MessageSquare, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
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
    token_symbol?: string;
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
    tokenMintAddress?: string;
    tokenSymbol?: string;
    variant?: "default" | "sidebar";
    className?: string;
    roomId?: string; // Optional: if provided, filters chat to this specific room
}

export default function CommunityChat({
    communityId,
    currentWallet,
    isMember,
    recipientWallet,
    tokenMintAddress,
    tokenSymbol,
    variant = "default",
    className = "",
    roomId
}: CommunityChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [realtimeStatus, setRealtimeStatus] = useState<string>("connecting");
    const [isSuperchatOpen, setIsSuperchatOpen] = useState(false);
    const [chatMode, setChatMode] = useState<"all" | "superchat">("all");

    const scrollRef = useRef<HTMLDivElement>(null);
    const pendingFetchIds = useRef<Set<string>>(new Set());
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Filtered messages based on mode
    const filteredMessages = useMemo(() => {
        if (chatMode === "superchat") {
            return messages.filter(m => m.is_superchat);
        }
        return messages;
    }, [messages, chatMode]);

    // Pinned Superchats (last 5 recent ones)
    const pinnedSuperchats = useMemo(() => {
        return messages.filter(m => m.is_superchat).slice(-5).reverse();
    }, [messages]);

    // 1. Fetch History
    const fetchHistory = async () => {
        try {
            const url = new URL(`/api/chat/${communityId}`, window.location.origin);
            if (roomId) url.searchParams.set("roomId", roomId);

            const res = await fetch(url.toString(), { cache: 'no-store' });
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
                },
                (payload: any) => {
                    if (payload.new && payload.new.community_id === communityId) {
                        // Filter by roomId if present
                        if (roomId && payload.new.room_id !== roomId) return;
                        if (!roomId && payload.new.room_id) return;

                        triggerBatchFetch([payload.new.id]);
                        if (payload.new.is_superchat) {
                            toast.success(`Signal Amplified: ${payload.new.superchat_amount} ${payload.new.token_symbol || 'SOL'}!`, {
                                icon: '🚀',
                                style: {
                                    borderRadius: '12px',
                                    background: '#1a1a1a',
                                    color: '#fff',
                                    border: '1px solid #eab308'
                                }
                            });
                        }
                    }
                }
            )
            .on("broadcast", { event: "new-batch" }, (payload: any) => {
                if (payload.payload?.messages) {
                    const ids = payload.payload.messages.map((m: any) => m.id);
                    triggerBatchFetch(ids);
                }
            })
            .subscribe((status) => {
                setRealtimeStatus(status);
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
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
                    roomId,
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
        <div className={`flex flex-col ${variant === 'sidebar' ? 'h-full bg-transparent' : 'h-[600px] bg-black/40 border border-white/10 rounded-2xl'} overflow-hidden relative ${className}`}>
            {/* Realtime Status Banner */}
            {realtimeStatus !== 'SUBSCRIBED' && (
                <div className="absolute top-0 left-0 right-0 py-1 bg-gradient-to-r from-orange-500/20 via-orange-500/40 to-orange-500/20 text-orange-200 text-[9px] font-black uppercase tracking-widest text-center z-20 animate-pulse border-b border-orange-500/30">
                    Syncing Signal...
                </div>
            )}

            {/* Header / Mode Toggle (Sidebar Variant) */}
            {variant === "sidebar" && (
                <div className="p-3 border-b border-white/10 bg-black/20 flex items-center justify-between">
                    <button
                        onClick={() => setChatMode(chatMode === 'all' ? 'superchat' : 'all')}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all text-gray-400 hover:text-white group"
                    >
                        {chatMode === 'all' ? <MessageSquare size={14} className="group-hover:text-orange-500" /> : <Zap size={14} className="group-hover:text-yellow-500" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{chatMode === 'all' ? 'Live Chat' : 'Superchats'}</span>
                        <ChevronDown size={12} className="opacity-40" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Filter size={12} className="text-gray-600" />
                    </div>
                </div>
            )}

            {/* Standard Header */}
            {variant === "default" && (
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <h3 className="font-bold text-white tracking-wide flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'} animate-pulse`}></span>
                        Community Pulse
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-mono">#{communityId.slice(0, 6)}</span>
                    </div>
                </div>
            )}

            {/* Pinned Superchats Section (YouTube Style) */}
            {pinnedSuperchats.length > 0 && variant === 'sidebar' && (
                <div className="flex gap-2 p-2 overflow-x-auto scrollbar-none bg-black/40 border-b border-white/5 backdrop-blur-sm">
                    {pinnedSuperchats.map((msg) => (
                        <div
                            key={`pinned-${msg.id}`}
                            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 min-w-[120px]"
                        >
                            <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                                <Zap size={10} fill="black" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-yellow-500 uppercase tracking-tighter leading-none">
                                    {msg.superchat_amount} {msg.token_symbol || 'SOL'}
                                </span>
                                <span className="text-[7px] text-gray-500 font-bold truncate max-w-[80px]">
                                    {msg.user?.username || 'Anonym'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {filteredMessages.length === 0 && chatMode === 'superchat' ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                        <Zap size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Signals Amplified Yet</p>
                    </div>
                ) : (
                    filteredMessages.map((msg, idx) => {
                        const isOwn = currentWallet === msg.wallet || msg.user_id === "me";
                        const isSuper = msg.is_superchat;

                        return (
                            <div key={msg.id || idx} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                {isSuper && (
                                    <div className="flex items-center gap-2 mb-1 px-1">
                                        <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.4)]">
                                            <Zap size={10} fill="black" stroke="black" />
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500">
                                            Superchat • {msg.superchat_amount} {msg.token_symbol || "SOL"}
                                        </span>
                                    </div>
                                )}
                                <div className={`flex ${isOwn ? "justify-end" : "justify-start"} w-full`}>
                                    <div className={`max-w-[90%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                        <div className={`px-3 py-2 rounded-2xl text-[12px] leading-relaxed transition-all ${isSuper
                                            ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/40 text-white font-bold"
                                            : variant === 'sidebar'
                                                ? "bg-transparent text-gray-200"
                                                : isOwn
                                                    ? "bg-orange-600/20 border border-orange-500/30 text-white rounded-tr-sm"
                                                    : "bg-white/10 border border-white/5 text-gray-200 rounded-tl-sm"
                                            }`}>
                                            {variant === 'sidebar' && !isSuper && (
                                                <span className="text-gray-500 font-bold mr-2 text-[11px]">
                                                    {msg.user?.username || (msg.wallet ? `${msg.wallet.slice(0, 4)}` : "Anon")}:
                                                </span>
                                            )}
                                            {msg.message}
                                        </div>
                                        {/* Timestamp/User Info - Only for default variant or solo superchats */}
                                        {variant === 'default' && (
                                            <div className="mt-1 text-[8px] text-gray-600 font-mono px-1 flex gap-2">
                                                <span className={isOwn ? "text-orange-400/50" : "text-gray-500"}>
                                                    {msg.user?.username || (msg.wallet ? `${msg.wallet.slice(0, 4)}...${msg.wallet.slice(-4)}` : "Anonym")}
                                                </span>
                                                <span suppressHydrationWarning className="opacity-50">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className={`p-4 ${variant === 'sidebar' ? 'bg-black/40 border-t border-white/5' : 'bg-white/5 border-t border-white/10'}`}>
                {!isMember ? (
                    <div className="text-center text-gray-500 text-[10px] py-3 bg-white/5 rounded-xl border border-white/5 border-dashed font-black uppercase tracking-widest">
                        Join Sector to transmit.
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/30 transition-all shadow-inner"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={sending || !newMessage.trim()}
                            className="px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            Send
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSuperchatOpen(true)}
                            disabled={!recipientWallet}
                            title={!recipientWallet ? "Establishing Uplink..." : "Send Superchat"}
                            className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-500 hover:bg-yellow-500/20 transition-all shadow-[0_0_15px_rgba(234,179,8,0.1)] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Zap size={14} fill="currentColor" />
                        </button>
                    </form>
                )}
            </div>

            <SuperchatModal
                isOpen={isSuperchatOpen}
                onClose={() => setIsSuperchatOpen(false)}
                communityId={communityId}
                roomId={roomId}
                recipientWallet={recipientWallet || ""}
                tokenMintAddress={tokenMintAddress}
                tokenSymbol={tokenSymbol}
            />
        </div>
    );
}
