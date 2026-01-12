"use client";

import { AnimatePresence, motion } from "framer-motion";
import FeedPost from "./FeedPost";

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
    };
}

interface PostModalProps {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
    onLikeToggle: (postId: string, newLiked: boolean) => void;
}

export default function PostModal({ post, isOpen, onClose, onLikeToggle }: PostModalProps) {
    if (!post) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 lg:p-10">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col lg:flex-row h-[90vh]"
                    >
                        {/* Left Side: Media */}
                        <div className="w-full lg:w-3/5 bg-black flex items-center justify-center border-b lg:border-b-0 lg:border-r border-white/10 overflow-hidden relative group">
                            {post.image_url ? (
                                (post.image_url.match(/\.(mp4|webm|ogg)$/i) || post.image_url.includes('video-media')) ? (
                                    <video
                                        src={post.image_url}
                                        controls
                                        autoPlay
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <img src={post.image_url} alt="" className="w-full h-full object-contain" />
                                )
                            ) : (
                                <div className="p-12 text-center">
                                    <p className="text-3xl font-medium tracking-tight italic text-white/90 leading-relaxed font-sans">
                                        "{post.content}"
                                    </p>
                                </div>
                            )}

                            {/* Close Button Mobile */}
                            <button
                                onClick={onClose}
                                className="lg:hidden absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Right Side: Info & Comments */}
                        <div className="w-full lg:w-2/5 flex flex-col bg-[#0a0a0a]">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 p-[1.5px]">
                                        <div className="w-full h-full rounded-full bg-black border border-black overflow-hidden">
                                            <img src={post.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.username}`} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    </div>
                                    <span className="font-black text-white text-sm uppercase tracking-tight">{post.user?.username || "anonymous"}</span>
                                </div>
                                <button onClick={onClose} className="hidden lg:block text-gray-500 hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                {/* We can use FeedPost here but we want it to look like a detail view, so we just use its parts or the whole thing with custom styles */}
                                <div className="p-2">
                                    <FeedPost post={post} onLikeToggle={onLikeToggle} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
