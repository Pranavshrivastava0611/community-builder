"use client";

import Navbar from "@/components/Navbar";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface Conversation {
    id: string;
    last_message_at: string;
    isGroup: boolean;
    name?: string;
    avatar_url?: string;
    participantCount?: number;
    otherUser?: {
        id: string;
        username: string;
        avatar_url?: string;
    };
}

export default function MessagesPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");
    const router = useRouter();

    useEffect(() => {
        async function fetchData() {
            try {
                const token = localStorage.getItem("authToken");
                if (!token) return;

                const [convRes, friendsRes] = await Promise.all([
                    fetch("/api/messages/conversations", { headers: { "Authorization": `Bearer ${token}` } }),
                    fetch("/api/friends/list", { headers: { "Authorization": `Bearer ${token}` } })
                ]);

                const convData = await convRes.json();
                const friendsData = await friendsRes.json();

                if (convData.conversations) setConversations(convData.conversations);
                if (friendsData.friends) setFriends(friendsData.friends);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleStartChat = async (targetUserId: string) => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch("/api/messages/conversations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ targetUserId })
            });
            const data = await res.json();
            if (data.conversationId) {
                router.push(`/messages/${data.conversationId}`);
            } else {
                toast.error(data.error || "Failed to start chat");
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error");
        } finally {
            setActionLoading(false);
        }
    };

    const timeSince = (date: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return "Just now";
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        return Math.floor(hours / 24) + "d";
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
            <Navbar />

            <main className="max-w-4xl mx-auto pt-10 px-4 pb-20">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-5xl font-black tracking-tighter uppercase italic">Inbox</h1>
                        <p className="text-[10px] font-black tracking-[0.3em] text-gray-700 uppercase mt-2">Encrypted Communication Hub</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="text-[10px] font-black tracking-widest uppercase bg-orange-500/10 text-orange-500 px-6 py-2 rounded-full border border-orange-500/20">
                            {conversations.length} Active Dialogues
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors flex items-center gap-2 group"
                        >
                            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                            Create Group
                        </button>
                    </div>
                </div>

                {/* Quick Start Friends Bar */}
                {!loading && friends.length > 0 && (
                    <section className="mb-12">
                        <h2 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-6 px-2">Frequent Contacts</h2>
                        <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                            {friends.map(friend => (
                                <button
                                    key={friend.id}
                                    onClick={() => handleStartChat(friend.id)}
                                    disabled={actionLoading}
                                    className="flex flex-col items-center gap-3 group shrink-0"
                                >
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-white/10 to-white/5 p-[1px] group-hover:from-orange-400 group-hover:to-rose-600 transition-all duration-500">
                                        <div className="w-full h-full rounded-full bg-black border-2 border-black overflow-hidden scale-[0.98]">
                                            <img src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-gray-500 group-hover:text-white transition-colors">{friend.username.split('-')[1] || friend.username}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {loading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-white/5 animate-pulse rounded-[2rem] border border-white/5" />
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="text-center py-40 bg-white/5 rounded-[3rem] border border-white/5 border-dashed">
                        <p className="text-gray-600 font-bold italic text-xl">Inbox is empty.</p>
                        <p className="text-gray-700 text-xs uppercase font-black tracking-widest mt-2">Start a conversation from the contacts above</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <h2 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 px-2">Recent Threads</h2>
                        {conversations.map((conv, idx) => (
                            <motion.div
                                key={conv.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Link href={`/messages/${conv.id}`}>
                                    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] flex items-center justify-between hover:bg-white/[0.05] hover:border-white/10 transition-all group cursor-pointer backdrop-blur-3xl">
                                        <div className="flex items-center gap-6">
                                            <div className="relative">
                                                <div className="w-16 h-16 rounded-full bg-white/5 p-[1.5px] group-hover:bg-orange-500 transition-colors duration-500">
                                                    <div className="w-full h-full rounded-full bg-black border-2 border-black overflow-hidden flex items-center justify-center">
                                                        {conv.isGroup ? (
                                                            <div className="w-full h-full bg-gradient-to-tr from-orange-400/20 to-rose-600/20 flex items-center justify-center">
                                                                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={conv.otherUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.otherUser?.username}`}
                                                                className="w-full h-full object-cover"
                                                                alt=""
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                {!conv.isGroup && <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-4 border-black rounded-full" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-2xl font-black uppercase tracking-tighter group-hover:text-orange-400 transition-colors">
                                                        {conv.isGroup ? conv.name : conv.otherUser?.username}
                                                    </h3>
                                                    {conv.isGroup && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/5 py-1 px-2 rounded text-gray-500">Group</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{conv.isGroup ? `${conv.participantCount} active members` : 'Tap to resume dialogue'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-1">Synchronized</p>
                                            <p className="text-xs font-mono text-white/30 italic">{timeSince(conv.last_message_at)}</p>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-3xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 overflow-hidden shadow-[0_0_100px_rgba(249,115,22,0.1)]"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] -mr-32 -mt-32" />

                            <div className="relative z-10">
                                <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Initialize Group</h2>
                                <p className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-8">Secure Multiplex Signal</p>

                                <div className="space-y-8">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">Signal Name</label>
                                        <input
                                            type="text"
                                            placeholder="E.G. ALPHA SQUAD"
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-gray-700"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 block">Select Transmitters ({selectedFriends.length})</label>
                                        <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                                            {friends.map(friend => (
                                                <button
                                                    key={friend.id}
                                                    onClick={() => {
                                                        setSelectedFriends(prev =>
                                                            prev.includes(friend.id)
                                                                ? prev.filter(id => id !== friend.id)
                                                                : [...prev, friend.id]
                                                        );
                                                    }}
                                                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${selectedFriends.includes(friend.id)
                                                            ? "bg-orange-500 border-orange-500 text-black shadow-[0_5px_15px_rgba(249,115,22,0.2)]"
                                                            : "bg-white/5 border-white/5 text-white hover:border-white/20"
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-black/20">
                                                        <img src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase truncate">{friend.username.split('-')[1] || friend.username}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={() => setShowCreateModal(false)}
                                            className="flex-1 py-5 rounded-2xl bg-white/5 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all font-mono"
                                        >
                                            Abort
                                        </button>
                                        <button
                                            disabled={!groupName || selectedFriends.length === 0 || actionLoading}
                                            onClick={async () => {
                                                setActionLoading(true);
                                                try {
                                                    const token = localStorage.getItem("authToken");
                                                    const res = await fetch("/api/messages/groups/create", {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                            "Authorization": `Bearer ${token}`
                                                        },
                                                        body: JSON.stringify({
                                                            name: groupName,
                                                            participantIds: selectedFriends
                                                        })
                                                    });
                                                    const data = await res.json();
                                                    if (data.conversationId) {
                                                        toast.success("Group Established");
                                                        router.push(`/messages/${data.conversationId}`);
                                                    } else {
                                                        toast.error(data.error || "Establishment Failed");
                                                    }
                                                } catch (e) {
                                                    toast.error("Network Error");
                                                } finally {
                                                    setActionLoading(false);
                                                }
                                            }}
                                            className="flex-[2] py-5 rounded-2xl bg-gradient-to-tr from-orange-500 to-rose-600 text-black text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:grayscale transition-all"
                                        >
                                            {actionLoading ? "Establishing..." : "Initialize Transmission"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
