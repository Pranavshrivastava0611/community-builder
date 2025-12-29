"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface FriendButtonProps {
    targetUserId: string;
}

export default function FriendButton({ targetUserId }: FriendButtonProps) {
    const [status, setStatus] = useState<'none' | 'pending' | 'accepted' | 'self' | 'loading'>('loading');
    const [isSender, setIsSender] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const token = localStorage.getItem("authToken");
                if (!token) return setStatus('none');
                const res = await fetch(`/api/friends/status/${targetUserId}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                setStatus(data.status);
                setIsSender(data.isSender);
            } catch (e) {
                setStatus('none');
            }
        };
        checkStatus();
    }, [targetUserId]);

    const handleStartChat = async () => {
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
            }
        } catch (e) {
            toast.error("Failed to start chat");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequest = async () => {
        const token = localStorage.getItem("authToken");
        if (!token) return toast.error("Log in to add friends");

        const previousStatus = status;
        setStatus('pending'); // Optimistic
        setIsSender(true);

        try {
            const res = await fetch("/api/friends/request", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ targetUserId })
            });
            if (!res.ok) throw new Error();
            toast.success("Friend request sent!");
        } catch (e) {
            setStatus(previousStatus);
            toast.error("Failed to send request");
        }
    };

    const handleRespond = async (action: 'accept' | 'decline') => {
        const token = localStorage.getItem("authToken");
        const previousStatus = status;
        setStatus(action === 'accept' ? 'accepted' : 'none');

        try {
            const res = await fetch("/api/friends/respond", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ senderId: targetUserId, action })
            });
            if (!res.ok) throw new Error();
            toast.success(action === 'accept' ? "You are now friends!" : "Request declined");
        } catch (e) {
            setStatus(previousStatus);
        }
    };

    if (status === 'self' || status === 'loading') return null;

    if (status === 'accepted') {
        return (
            <div className="flex gap-2">
                <button
                    disabled={actionLoading}
                    onClick={handleStartChat}
                    className="bg-orange-500 text-black px-8 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 group shadow-lg shadow-orange-500/20"
                >
                    <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    Message
                </button>
                <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest text-green-500 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Friends
                </div>
            </div>
        );
    }

    if (status === 'pending') {
        if (isSender) {
            return (
                <button className="bg-white/5 border border-white/10 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest text-gray-500">
                    Request Sent
                </button>
            );
        }
        return (
            <div className="flex gap-2">
                <button
                    onClick={() => handleRespond('accept')}
                    className="bg-orange-500 text-black px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-all"
                >
                    Accept
                </button>
                <button
                    onClick={() => handleRespond('decline')}
                    className="bg-white/5 border border-white/10 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:bg-red-500/20 transition-all"
                >
                    Decline
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleRequest}
            className="bg-white text-black px-8 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all shadow-xl shadow-orange-500/10"
        >
            Add Friend
        </button>
    );
}
