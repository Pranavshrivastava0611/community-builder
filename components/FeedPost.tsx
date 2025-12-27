"use client";

import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface Post {
    id: string;
    community_id: string;
    user_id: string;
    content: string;
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
        token_symbol?: string; // Optional
    };
}

interface FeedPostProps {
    post: Post;
    onLikeToggle: (postId: string, newLiked: boolean) => void;
}

export default function FeedPost({ post, onLikeToggle }: FeedPostProps) {
    const [liking, setLiking] = useState(false);

    // Comment State
    const [expanded, setExpanded] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [commenting, setCommenting] = useState(false);
    const [count, setCount] = useState(post.comment_count);

    // Realtime Comment Count
    useEffect(() => {
        const channel = supabase
            .channel(`post-comments-${post.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments',
                    filter: `post_id=eq.${post.id}`
                },
                (payload: any) => {
                    // Increment count when a new comment is added by anyone
                    setCount(prev => prev + 1);
                    // If comments are expanded, we might want to refresh them or append
                    // For now we just stay in sync with count
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [post.id]);

    const handleLike = async () => {
        if (liking) return;
        setLiking(true);

        // Optimistic Update
        const previousLiked = post.isLiked;
        onLikeToggle(post.id, !previousLiked);

        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                toast.error("Please login to like");
                onLikeToggle(post.id, previousLiked); // Revert
                return;
            }

            const res = await fetch("/api/feed/like", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ postId: post.id })
            });

            if (!res.ok) throw new Error("Failed");

        } catch {
            onLikeToggle(post.id, previousLiked); // Revert
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
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingComments(false);
            }
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setCommenting(true);
        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                toast.error("Login to comment");
                return;
            }

            const res = await fetch("/api/feed/comment", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ postId: post.id, content: newComment })
            });

            if (!res.ok) throw new Error("Failed");

            const fetchRes = await fetch(`/api/feed/comments/${post.id}`);
            const fetchData = await fetchRes.json();
            if (fetchData.comments) setComments(fetchData.comments);

            setNewComment("");
            // Count will be updated by the realtime subscription if insert is successful
            // But we can also keep the local increment for immediate feel if needed, 
            // though the subscription might double count if not careful.
            // Let's remove the local increment and let the subscription handle it.
            // Actually, Subscription triggers for own inserts too.
            // So we remove setCount(prev => prev + 1); here.
            // setCount(prev => prev + 1);

        } catch {
            toast.error("Failed");
        } finally {
            setCommenting(false);
        }
    };

    return (
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md mb-4 hover:border-white/20 transition-all">
            {/* Optional Community Header */}
            {post.community && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                    <span className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                        Posted in {post.community.name} {post.community.token_symbol ? `($${post.community.token_symbol})` : ""}
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold overflow-hidden">
                    {post.user?.avatar_url ? (
                        <img src={post.user.avatar_url} alt="User" className="w-full h-full object-cover" />
                    ) : (
                        post.user?.username?.[0]?.toUpperCase() || "U"
                    )}
                </div>
                <div>
                    <h4 className="font-bold text-white text-sm">
                        {post.user?.username || "Unknown User"}
                    </h4>
                    <span className="text-xs text-gray-500" suppressHydrationWarning>
                        {new Date(post.created_at).toLocaleDateString()} • {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="text-gray-200 mb-6 text-base leading-relaxed whitespace-pre-wrap">
                {post.content}
            </div>

            {/* Footer / Actions */}
            <div className="flex items-center gap-6 border-t border-white/5 pt-4">
                <button
                    onClick={handleLike}
                    disabled={liking}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${post.isLiked ? "text-pink-500" : "text-gray-500 hover:text-pink-400"}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${post.isLiked ? "fill-current" : "none"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {post.like_count}
                </button>

                <button
                    onClick={toggleComments}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${expanded ? "text-blue-400" : "text-gray-500 hover:text-blue-400"}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {count}
                </button>
            </div>

            {/* Comments Section */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                    {loadingComments ? (
                        <div className="text-center text-xs text-gray-500">Loading comments...</div>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {comments.map((c: any) => (
                                <div key={c.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-400">
                                        {(c.author?.username?.[0] || c.user?.username?.[0])?.toUpperCase() || "?"}
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 flex-1">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-xs font-bold text-gray-300">{c.author?.username || c.user?.username || "Unknown"}</span>
                                            <span className="text-[10px] text-gray-600">{new Date(c.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-gray-400 text-sm leading-snug">{c.content}</p>
                                    </div>
                                </div>
                            ))}
                            {comments.length === 0 && <div className="text-center text-xs text-gray-600 py-2">No comments yet.</div>}
                        </div>
                    )}

                    <form onSubmit={handleComment} className="flex gap-2">
                        <input
                            type="text"
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            disabled={commenting}
                        />
                        <button
                            type="submit"
                            disabled={commenting || !newComment.trim()}
                            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-500/30 disabled:opacity-50"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
