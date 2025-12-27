"use client";

import { supabase } from "@/utils/supabase";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface Post {
    id: string;
    community_id: string;
    user_id: string;
    content: string;
    image_url?: string;
    created_at: string;
    like_count: number;
    comment_count: number;
    isLiked: boolean;
    user?: {
        username?: string;
        avatar_url?: string;
    };
    community?: {
        name: string;
        image_url?: string;
        token_symbol?: string;
    };
}

interface FeedPostProps {
    post: Post;
    onLikeToggle: (postId: string, newLiked: boolean) => void;
}

export default function FeedPost({ post: initialPost, onLikeToggle }: FeedPostProps) {
    const [post, setPost] = useState(initialPost);
    const [liking, setLiking] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [commenting, setCommenting] = useState(false);
    const [count, setCount] = useState(post.comment_count);

    // Management States
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [editPostContent, setEditPostContent] = useState(post.content);
    const [showOptions, setShowOptions] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setCurrentUserId(payload.id);
            } catch (e) { }
        }
    }, []);

    useEffect(() => {
        const channel = supabase
            .channel(`post-comments-${post.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` },
                () => { setCount(prev => prev + 1); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [post.id]);

    const handleLike = async () => {
        if (liking) return;
        setLiking(true);
        const previousLiked = post.isLiked;
        onLikeToggle(post.id, !previousLiked);
        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                toast.error("Please login");
                onLikeToggle(post.id, previousLiked);
                return;
            }
            const res = await fetch("/api/feed/like", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ postId: post.id })
            });
            if (!res.ok) throw new Error("Failed");
        } catch {
            onLikeToggle(post.id, previousLiked);
            toast.error("Failed to like");
        } finally {
            setLiking(false);
        }
    };

    const toggleComments = async () => {
        setExpanded(!expanded);
        if (!expanded && comments.length === 0) {
            setLoadingComments(true);
            try {
                const res = await fetch(`/api/feed/comments/${post.id}`);
                const data = await res.json();
                if (data.comments) setComments(data.comments);
            } catch (e) { console.error(e); } finally { setLoadingComments(false); }
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setCommenting(true);
        try {
            const token = localStorage.getItem("authToken");
            if (!token) { toast.error("Login to comment"); return; }
            const res = await fetch("/api/feed/comment", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ postId: post.id, content: newComment })
            });
            if (!res.ok) throw new Error("Failed");
            const fetchRes = await fetch(`/api/feed/comments/${post.id}`);
            const fetchData = await fetchRes.json();
            if (fetchData.comments) setComments(fetchData.comments);
            setNewComment("");
        } catch { toast.error("Failed"); } finally { setCommenting(false); }
    };

    const handleShare = async () => {
        const shareData = {
            title: `Post by ${post.user?.username || "anonymous"}`,
            text: post.content.substring(0, 100),
            url: window.location.origin + `/communities/${post.community_id}/?post=${post.id}`,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                toast.success("Link copied to clipboard!");
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Delete Modal State
    const [itemToDelete, setItemToDelete] = useState<{ type: 'post' | 'comment', id: string } | null>(null);

    const handleEditPost = async () => {
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch(`/api/feed/posts/${post.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ content: editPostContent })
            });
            if (res.ok) {
                setPost({ ...post, content: editPostContent });
                setIsEditingPost(false);
                setShowOptions(false);
                toast.success("Post updated");
            } else { toast.error("Update failed"); }
        } catch { toast.error("Error"); }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        try {
            const token = localStorage.getItem("authToken");
            if (itemToDelete.type === 'post') {
                const res = await fetch(`/api/feed/posts/${itemToDelete.id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    setIsDeleted(true);
                    toast.success("Post deleted");
                } else { toast.error("Delete failed"); }
            } else {
                const res = await fetch(`/api/feed/comment/${itemToDelete.id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    setComments(prev => prev.filter(c => c.id !== itemToDelete.id));
                    setCount(prev => prev - 1);
                    toast.success("Comment deleted");
                } else { toast.error("Delete failed"); }
            }
        } catch { toast.error("Error"); } finally {
            setItemToDelete(null);
        }
    };

    const timeSince = (date: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return Math.floor(seconds) + "s";
    };

    if (isDeleted) return null;

    return (
        <div className="w-full bg-black border-b border-white/5 pb-10 relative">
            {/* Header */}
            <div className="flex items-center justify-between px-2 mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 p-[1.5px]">
                        <div className="w-full h-full rounded-full bg-black border border-black overflow-hidden">
                            {post.user?.avatar_url && <img src={post.user.avatar_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white hover:text-gray-400 cursor-pointer">{post.user?.username || "anonymous"}</span>
                        <span className="text-gray-500 text-sm">•</span>
                        <span className="text-gray-500 text-sm font-medium">{timeSince(post.created_at)}</span>
                    </div>
                </div>

                <div className="relative">
                    <button onClick={() => setShowOptions(!showOptions)} className="text-white hover:text-gray-500 p-2">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                    </button>

                    <AnimatePresence>
                        {showOptions && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-0 top-10 w-40 bg-[#121212] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                            >
                                {currentUserId === post.user_id ? (
                                    <>
                                        <button onClick={() => { setIsEditingPost(true); setShowOptions(false); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 font-bold">Edit Post</button>
                                        <button onClick={() => { setItemToDelete({ type: 'post', id: post.id }); setShowOptions(false); }} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-white/5 font-bold border-t border-white/5">Delete</button>
                                    </>
                                ) : (
                                    <button onClick={() => { toast.success("Reported"); setShowOptions(false); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 font-bold">Report</button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Media Area */}
            {post.image_url ? (
                <div className="w-full aspect-[4/5] sm:aspect-square bg-neutral-900 rounded-sm border border-white/5 overflow-hidden mb-3">
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                </div>
            ) : (
                <div className="w-full p-10 bg-gradient-to-br from-neutral-900 to-black border border-white/5 rounded-sm mb-3">
                    {isEditingPost ? (
                        <div className="space-y-4">
                            <textarea
                                value={editPostContent}
                                onChange={e => setEditPostContent(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-orange-500/50"
                            />
                            <div className="flex gap-2">
                                <button onClick={handleEditPost} className="bg-orange-500 text-black font-black px-4 py-2 rounded-lg text-sm">Save</button>
                                <button onClick={() => setIsEditingPost(false)} className="bg-white/5 text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-lg font-medium tracking-tight whitespace-pre-wrap">{post.content}</p>
                    )}
                </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between px-2 mb-3">
                <div className="flex items-center gap-4">
                    <button onClick={handleLike} className={`${post.isLiked ? "text-rose-500" : "text-white"} hover:scale-110 transition-transform`}>
                        {post.isLiked ? (
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                        ) : (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        )}
                    </button>
                    <button onClick={toggleComments} className="text-white hover:scale-110 transition-transform">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </button>
                    <button onClick={handleShare} className="text-white hover:scale-110 transition-transform">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </button>
                </div>
                <button className="text-white hover:scale-110 transition-transform">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                </button>
            </div>

            {/* Likes & Caption */}
            <div className="px-2 space-y-1">
                <p className="text-sm font-black text-white">{post.like_count.toLocaleString()} likes</p>
                <div className="text-sm">
                    <span className="font-black text-white mr-2">{post.user?.username || "anonymous"}</span>
                    {isEditingPost && post.image_url ? (
                        <div className="mt-2 space-y-2">
                            <textarea
                                value={editPostContent}
                                onChange={e => setEditPostContent(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white resize-none focus:outline-none"
                            />
                            <div className="flex gap-2">
                                <button onClick={handleEditPost} className="text-orange-500 font-bold text-xs uppercase">Save</button>
                                <button onClick={() => setIsEditingPost(false)} className="text-gray-500 font-bold text-xs uppercase">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <span className="text-gray-200">{post.content}</span>
                    )}
                </div>
                {post.community && (
                    <div className="pt-1">
                        <Link href={`/communities/${post.community.name}`}>
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full hover:bg-orange-500/20 transition-colors cursor-pointer">
                                {post.community.name}
                            </span>
                        </Link>
                    </div>
                )}
                {count > 0 && (
                    <button onClick={toggleComments} className="text-sm text-gray-500 font-medium block pt-1 hover:text-gray-400">
                        View all {count} comments
                    </button>
                )}
            </div>

            {/* Comments Expansion */}
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 px-2 space-y-4">
                        <div className="max-h-60 overflow-y-auto space-y-4 no-scrollbar">
                            {comments.map((c: any) => (
                                <div key={c.id} className="flex justify-between items-start">
                                    <div className="flex gap-3 text-sm">
                                        <span className="font-black text-white whitespace-nowrap">{c.author?.username || "user"}</span>
                                        <span className="text-gray-300">{c.content}</span>
                                    </div>
                                    {(currentUserId === c.author_id) && (
                                        <button onClick={() => setItemToDelete({ type: 'comment', id: c.id })} className="text-gray-600 hover:text-red-500 text-xs font-bold uppercase tracking-tighter transition-colors">Delete</button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleComment} className="flex gap-2 border-t border-white/10 pt-3">
                            <input
                                type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="bg-transparent flex-1 text-sm focus:outline-none text-white"
                            />
                            <button type="submit" disabled={commenting || !newComment.trim()} className="text-sm font-black text-blue-500 disabled:opacity-30">Post</button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Delete Confirmation Modal */}
            <AnimatePresence>
                {itemToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setItemToDelete(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                        >
                            <div className="p-8 text-center">
                                <h3 className="text-xl font-black text-white mb-2">Delete {itemToDelete.type}?</h3>
                                <p className="text-gray-400 text-sm">Are you sure you want to delete this {itemToDelete.type}? This action cannot be undone.</p>
                            </div>
                            <div className="flex flex-col border-t border-white/5">
                                <button
                                    onClick={confirmDelete}
                                    className="w-full py-4 text-red-500 font-black text-sm hover:bg-red-500/5 transition-colors border-b border-white/5"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setItemToDelete(null)}
                                    className="w-full py-4 text-white font-bold text-sm hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
