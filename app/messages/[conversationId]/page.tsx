"use client";

import { supabase } from "@/utils/supabase";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

interface Message {
    id: string;
    sender_id: string;
    content: string;
    image_url?: string;
    created_at: string;
    sender: {
        username: string;
        avatar_url?: string;
    }
}

export default function ChatPage() {
    const params = useParams() as any;
    const conversationId = params.conversationId as string;
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [messageInput, setMessageInput] = useState("");
    const [sending, setSending] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<any>(null);

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [myCommunities, setMyCommunities] = useState<any[]>([]);
    const [fetchingComm, setFetchingComm] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setCurrentUserId(payload.id);
            } catch (e) { }
        }

        async function initChat() {
            try {
                // Fetch History
                const res = await fetch(`/api/messages/history/${conversationId}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                setMessages(data.messages || []);
                setMetadata(data.metadata);
            } catch (e: any) {
                console.error(e);
                toast.error(e.message);
                router.push("/messages");
            } finally {
                setLoading(false);
            }
        }

        initChat();

        // Realtime Subscription with Deduplication & Profile Caching
        const senderCache: Record<string, any> = {};

        const channel = supabase
            .channel(`chat-${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, async (payload) => {
                const senderId = payload.new.sender_id;
                let senderInfo = senderCache[senderId];

                if (!senderInfo) {
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', senderId)
                        .single();
                    senderInfo = prof;
                    senderCache[senderId] = prof;
                }

                const fullMsg: Message = {
                    id: payload.new.id,
                    sender_id: payload.new.sender_id,
                    content: payload.new.content,
                    image_url: payload.new.image_url,
                    created_at: payload.new.created_at,
                    sender: senderInfo
                };

                setMessages(prev => {
                    const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.content === fullMsg.content));
                    if (filtered.some(m => m.id === fullMsg.id)) return filtered;
                    return [...filtered, fullMsg];
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [conversationId, currentUserId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Messaging Optimization: Buffer & Optimistic UI
    const [messageBuffer, setMessageBuffer] = useState<{ content: string, imageUrl?: string }[]>([]);

    // Sync Buffer to DB (Batching)
    useEffect(() => {
        if (messageBuffer.length === 0) return;

        const flushBuffer = async () => {
            const currentBatch = [...messageBuffer];
            setMessageBuffer([]); // Reset buffer for next batch

            try {
                const token = localStorage.getItem("authToken");
                await fetch("/api/messages/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        conversationId,
                        batch: currentBatch
                    })
                });
                // Note: We don't need to manually update messages here because 
                // the Realtime subscription will handle the incoming confirmed messages.
            } catch (e) {
                console.error("Batch sync failed", e);
                toast.error("Some messages failed to sync");
            }
        };

        const timer = setTimeout(flushBuffer, 1000); // 1s Batching window
        return () => clearTimeout(timer);
    }, [messageBuffer, conversationId]);

    const handleSendMessage = async (contentOverride?: string, imageUrl?: string) => {
        const finalContent = contentOverride || messageInput;
        if (!finalContent.trim() && !imageUrl) return;

        const newMsg = {
            id: `temp-${Date.now()}`,
            sender_id: currentUserId!,
            content: finalContent,
            image_url: imageUrl,
            created_at: new Date().toISOString(),
            sender: {
                username: "You",
                avatar_url: ""
            }
        };

        setMessages(prev => [...prev, newMsg]);
        setMessageBuffer(prev => [...prev, { content: finalContent, imageUrl }]);
        if (!contentOverride) setMessageInput("");
    };

    const handleInviteClick = async () => {
        setShowInviteModal(true);
        setFetchingComm(true);
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch("/api/user/communities", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.communities) setMyCommunities(data.communities);
        } catch (e) {
            console.error(e);
        } finally {
            setFetchingComm(false);
        }
    };

    const sendCommunityInvite = (comm: any) => {
        const inviteText = `🚨 INVITATION: Join me in the "${comm.name}" community! \n[JOIN HERE](/communities/${comm.name})`;
        handleSendMessage(inviteText);
        setShowInviteModal(false);
        toast.success(`Invite to ${comm.name} sent!`);
    };

    if (loading) return <div className="h-screen bg-black flex items-center justify-center text-orange-500 font-black italic animate-pulse">SYNCING ENCRYPTED DIALOGUE...</div>;

    return (
        <div className="h-screen bg-black text-white flex flex-col font-sans overflow-hidden">
            {/* Chat Header */}
            <header className="p-6 border-b border-white/10 flex items-center gap-4 bg-black/50 backdrop-blur-xl z-20">
                <Link href="/messages" className="p-2 hover:bg-white/5 rounded-full transition-colors font-black">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                </Link>

                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 to-rose-600 p-[1.5px]">
                    <div className="w-full h-full rounded-full bg-black border border-black overflow-hidden flex items-center justify-center">
                        {metadata?.is_group ? (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                        ) : (
                            <img
                                src={metadata?.otherUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${metadata?.otherUser?.username || 'user'}`}
                                className="w-full h-full object-cover"
                                alt=""
                            />
                        )}
                    </div>
                </div>

                <div className="flex-1">
                    <h2 className="font-black uppercase tracking-tighter text-xl truncate max-w-[200px]">
                        {metadata?.is_group ? metadata.name : metadata?.otherUser?.username || "Dialogue"}
                    </h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${metadata?.is_group ? 'text-gray-500' : 'text-green-500'}`}>
                        {metadata?.is_group ? (
                            <>{metadata.participants?.length || 0} Members in Thread</>
                        ) : (
                            <>
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                Synchronized
                            </>
                        )}
                    </p>
                </div>
            </header>

            {/* Message Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-hide bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900/20 to-transparent"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                        <div className="w-20 h-20 mb-4 bg-white/5 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </div>
                        <p className="font-black uppercase tracking-tighter">Secure Communication Established</p>
                        <p className="text-xs font-medium">Messages are encrypted and ephemeral.</p>
                    </div>
                )}

                <AnimatePresence>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[75%] px-5 py-3 rounded-[24px] shadow-xl ${msg.sender_id === currentUserId
                                ? 'bg-white text-black font-medium'
                                : 'bg-white/5 border border-white/10 text-white backdrop-blur-3xl'
                                }`}>
                                {metadata?.is_group && msg.sender_id !== currentUserId && (
                                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-1">{msg.sender?.username}</p>
                                )}
                                {msg.image_url && (
                                    <img src={msg.image_url} className="w-full rounded-xl mb-2 object-cover" alt="" />
                                )}
                                {msg.content.startsWith('🚨 INVITATION:') ? (
                                    <div className="py-2">
                                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-2">
                                            <p className="text-orange-500 font-black text-[10px] uppercase tracking-widest mb-2">Social Discovery</p>
                                            <p className="text-sm font-bold text-white leading-relaxed">
                                                {msg.content.split('\n')[0]}
                                            </p>
                                        </div>
                                        <Link
                                            href={msg.content.split('(')[1]?.split(')')[0] || '#'}
                                            className="block w-full text-center py-3 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 hover:text-white transition-all shadow-xl"
                                        >
                                            Join Community
                                        </Link>
                                    </div>
                                ) : (
                                    <p className="leading-relaxed">{msg.content}</p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-8 bg-black/80 backdrop-blur-3xl border-t border-white/5 relative z-30">
                <div className="max-w-4xl mx-auto flex items-end gap-4">
                    {/* Interaction Hub */}
                    <div className="flex items-center pb-1">
                        <motion.button
                            whileHover={{ rotate: 90, scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleInviteClick}
                            className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all shadow-lg ${showInviteModal ? 'bg-orange-500 border-orange-500 text-white rotate-45' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-orange-500/50'}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        </motion.button>
                    </div>

                    {/* Message Vessel */}
                    <div className="flex-1 relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-rose-600 rounded-[2rem] opacity-0 group-focus-within:opacity-20 transition-opacity duration-500 blur-md" />
                        <div className="relative flex items-center bg-[#111] border border-white/10 rounded-[2rem] overflow-hidden group-focus-within:border-white/20 transition-all">
                            <textarea
                                rows={1}
                                value={messageInput}
                                onChange={e => setMessageInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Whisper into the void..."
                                className="w-full bg-transparent px-8 py-5 outline-none resize-none font-medium placeholder:text-gray-700 text-sm leading-relaxed max-h-32 scrollbar-hide"
                            />

                            {/* Send Trigger */}
                            <AnimatePresence>
                                {(messageInput.trim()) && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, x: 20 }}
                                        onClick={() => handleSendMessage()}
                                        className="m-2 w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all shadow-xl active:scale-95 shrink-0"
                                    >
                                        <svg className="w-5 h-5 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Quick Reaction (Ghost) */}
                    <div className="pb-1 hidden sm:block">
                        <button className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-600 hover:text-orange-500 transition-all">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>
                </div>

                {/* Visual Status */}
                <div className="max-w-4xl mx-auto mt-4 px-8 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-700">
                    <div className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                        End-to-end Synchronized
                    </div>
                    <div className="opacity-0 group-focus-within:opacity-100 transition-opacity duration-300">
                        Press Enter to Transmit
                    </div>
                </div>
            </div>

            {/* Community Invite Portal */}
            <AnimatePresence>
                {showInviteModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInviteModal(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 100, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 100, scale: 0.9 }}
                            className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-[#111] border border-white/10 rounded-[2.5rem] z-[70] p-8 shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-black uppercase tracking-tighter">Your Communities</h2>
                                <button onClick={() => setShowInviteModal(false)} className="text-gray-500 hover:text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="space-y-3 max-h-80 overflow-y-auto no-scrollbar">
                                {fetchingComm ? (
                                    [1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-2xl" />)
                                ) : myCommunities.length === 0 ? (
                                    <p className="text-center py-10 text-gray-600 text-sm font-bold italic">You haven't joined any communities yet.</p>
                                ) : (
                                    myCommunities.map(comm => (
                                        <button
                                            key={comm.id}
                                            onClick={() => sendCommunityInvite(comm)}
                                            className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left border border-transparent hover:border-white/5 group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden">
                                                <img src={comm.image_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${comm.name}`} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-white group-hover:text-orange-500 transition-colors">{comm.name}</p>
                                                <p className="text-[10px] uppercase font-black text-gray-600 tracking-widest mt-0.5">Tap to Invite</p>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-700 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
