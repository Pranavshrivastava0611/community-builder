"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Notification {
    id: string;
    type: 'like' | 'comment' | 'message' | 'mention' | 'friend_request' | 'friend_accept';
    actor_id: string;
    actor: {
        username: string;
        avatar_url?: string;
    };
    created_at: string;
    is_read: boolean;
}

export default function NotificationsPopover({ onClose }: { onClose: () => void }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const token = localStorage.getItem("authToken");
                const res = await fetch("/api/notifications", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.notifications) {
                    // Only show unread notifications to keep the UI clean and fix "Accept" button lingering
                    setNotifications(data.notifications.filter((n: any) => !n.is_read));
                }

                // Mark all as read after opening
                fetch("/api/notifications", {
                    method: "PATCH",
                    headers: { "Authorization": `Bearer ${token}` }
                });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, []);

    const getVerb = (type: string) => {
        switch (type) {
            case 'like': return 'liked your post';
            case 'comment': return 'commented on your post';
            case 'message': return 'sent you a message';
            case 'friend_request': return 'sent you a friend request';
            case 'friend_accept': return 'accepted your friend request';
            default: return 'interacted with you';
        }
    };

    const handleFriendAction = async (notifId: string, actorId: string, action: 'accept' | 'decline') => {
        const token = localStorage.getItem("authToken");

        // Optimistic Update
        setNotifications(prev => prev.filter(n => n.id !== notifId));

        try {
            await fetch("/api/friends/respond", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ senderId: actorId, action })
            });
            toast.success(action === 'accept' ? "Friend Request Accepted!" : "Request Declined");
        } catch (e) {
            toast.error("Social action failed");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute left-[240px] top-0 w-80 h-screen bg-black/80 backdrop-blur-3xl border-r border-white/10 z-[60] p-6 shadow-2xl"
        >
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Activity</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="space-y-2">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-2xl" />)
                ) : notifications.length === 0 ? (
                    <div className="text-center py-10 opacity-30 italic font-bold">No new activity.</div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} className="flex flex-col gap-3 p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-rose-600 p-[1.5px] shrink-0">
                                    <div className="w-full h-full rounded-full bg-black border border-black overflow-hidden">
                                        <img
                                            src={notif.actor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.actor.username}`}
                                            className="w-full h-full object-cover"
                                            alt=""
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold leading-tight truncate">
                                        <span className="text-orange-500">{notif.actor.username}</span> {getVerb(notif.type)}
                                    </p>
                                    <p className="text-[10px] uppercase font-black text-gray-600 tracking-widest mt-0.5">
                                        {new Date(notif.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {notif.type === 'friend_request' && (
                                <div className="flex gap-2 pl-11">
                                    <button
                                        onClick={() => handleFriendAction(notif.id, notif.actor_id, 'accept')}
                                        className="flex-1 bg-white text-black text-[10px] font-black uppercase py-2 rounded-lg hover:bg-orange-500 hover:text-white transition-colors"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleFriendAction(notif.id, notif.actor_id, 'decline')}
                                        className="flex-1 bg-white/5 text-white text-[10px] font-black uppercase py-2 rounded-lg hover:bg-red-500/20 transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
