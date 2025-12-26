"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import GlowButton from "./GlowButton";

// Initializing Supabase Client for Realtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY;

let supabaseClient: any = null;
if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
} else {
    console.error("⚠️ Supabase Credentials Missing! Chat will not work.");
}

interface Message {
    id: string;
    user_id: string;
    wallet: string;
    message: string;
    created_at: string;
    type: "text" | "image" | "system";
    user?: {
        username?: string;
        avatar_url?: string;
    };
}

interface CommunityChatProps {
    communityId: string;
    currentWallet?: string; // To identify 'own' messages
    isMember: boolean;
}

export default function CommunityChat({ communityId, currentWallet, isMember }: CommunityChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Fetch History
    useEffect(() => {
        async function fetchHistory() {
            try {
                const res = await fetch(`/api/chat/${communityId}`);
                const data = await res.json();
                if (data.messages) {
                    setMessages(data.messages);
                    scrollToBottom();
                }
            } catch (e) {
                console.error("Failed to load chat history", e);
            }
        }
        fetchHistory();
    }, [communityId]);

    // 2. Realtime Subscription
    useEffect(() => {
        if (!supabaseClient) return;

        const channel = supabaseClient
            .channel(`room:${communityId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "community_chat_messages",
                    filter: `community_id=eq.${communityId}`,
                },
                (payload: any) => {
                    const newMsg = payload.new as Message;
                    // Optimistically we might have added it, avoid dupe if ID matches? 
                    // But our API fetch is history. Realtime is new.
                    setMessages((prev) => [...prev, newMsg]);
                    scrollToBottom();
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [communityId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !isMember) return;

        const tempMsg = newMessage;
        setNewMessage(""); // Clear input immediately
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
                    message: tempMsg,
                    type: "text"
                })
            });

            if (!res.ok) throw new Error("Failed to send");

            // We don't need to manually add to state because Realtime will push it back to us.
            // But for lower latency feel, we could optimistic update.
            // Let's rely on Realtime for consistency for now.

        } catch (error) {
            console.error(error);
            toast.error("Message failed to send");
            setNewMessage(tempMsg); // Restore input
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <h3 className="font-bold text-white tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Community Chat
                </h3>
                <span className="text-xs text-gray-500 font-mono">Live</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {messages.map((msg, idx) => {
                    const isOwn = currentWallet === msg.wallet; // Check Wallet Match
                    return (
                        <div key={idx} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isOwn
                                    ? "bg-orange-600/20 border border-orange-500/30 text-white rounded-tr-sm"
                                    : "bg-white/10 border border-white/5 text-gray-200 rounded-tl-sm"
                                    }`}>
                                    {msg.message}
                                </div>
                                <div className="mt-1 text-[10px] text-gray-600 font-mono px-1 flex gap-2">
                                    <span className={isOwn ? "text-orange-400/50" : "text-gray-500"}>
                                        {msg.user?.username || (msg.wallet ? `${msg.wallet.slice(0, 4)}...${msg.wallet.slice(-4)}` : "User")}
                                    </span>
                                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                    <div className="text-center text-gray-500 text-sm py-2">
                        Join the community to start chatting.
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors"
                            disabled={sending}
                        />
                        <GlowButton type="submit" disabled={sending || !newMessage.trim()} className="px-6">
                            Send
                        </GlowButton>
                    </form>
                )}
            </div>
        </div>
    );
}
