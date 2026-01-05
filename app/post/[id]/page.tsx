"use client";

import FeedPost from "@/components/FeedPost";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: postId } = use(params);
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function fetchPost() {
            setLoading(true);
            try {
                const token = localStorage.getItem("authToken");
                const res = await fetch(`/api/feed/posts/${postId}`, {
                    headers: token ? { "Authorization": `Bearer ${token}` } : {}
                });
                const data = await res.json();
                if (data.post) {
                    setPost(data.post);
                }
            } catch (err) {
                console.error("Failed to fetch post:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchPost();
    }, [postId]);

    const handleLikeToggle = (postId: string, newLiked: boolean) => {
        setPost((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                isLiked: newLiked,
                like_count: newLiked ? prev.like_count + 1 : Math.max(0, prev.like_count - 1)
            };
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
                <h1 className="text-2xl font-black uppercase tracking-tighter">Post Signal Lost</h1>
                <p className="text-gray-500 text-sm">The broadcast you're looking for doesn't exist or was retracted.</p>
                <Link href="/feed" className="px-6 py-2 bg-white text-black font-black uppercase text-xs rounded-full">Back to Feed</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-orange-500/30">
            <Toaster position="bottom-right" />

            {/* Nav Header */}
            <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 lg:px-8 sticky top-0 bg-black/80 backdrop-blur-xl z-[100]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-black tracking-tighter hidden sm:block">POST <span className="text-orange-500">SIGNAL</span></h1>
                </div>

                <Link href="/feed" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-black group-hover:rotate-6 transition-transform">S</div>
                    <span className="font-black text-xs uppercase tracking-widest hidden sm:block">Solana Community</span>
                </Link>
            </header>

            <main className="max-w-[1200px] mx-auto py-8 lg:py-12 px-4 flex flex-col lg:flex-row gap-8 items-start justify-center">
                {/* Visual Content Column */}
                <div className="w-full lg:w-[600px] bg-neutral-900/50 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative group">
                    {post.image_url ? (
                        <div className="aspect-[4/5] sm:aspect-square">
                            <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="aspect-[4/5] sm:aspect-square flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black p-12">
                            <p className="text-2xl font-medium tracking-tight text-center leading-relaxed italic text-white/90">
                                "{post.content}"
                            </p>
                        </div>
                    )}

                    {/* Floating Community Tag */}
                    {post.community && (
                        <Link
                            href={`/communities/${post.community.name}`}
                            className="absolute top-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-500 hover:bg-orange-500 hover:text-black transition-all"
                        >
                            {post.community.name}
                        </Link>
                    )}
                </div>

                {/* Info & Feedback Column */}
                <div className="w-full lg:w-[450px] space-y-6">
                    {/* Poster Info */}
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-3xl border border-white/10">
                        <Link href={`/profile/${post.user?.username}`} className="flex items-center gap-4 group">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 p-[1.5px]">
                                <div className="w-full h-full rounded-full bg-black border border-black overflow-hidden relative">
                                    <img
                                        src={post.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.username || post.user_id}`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-black text-white group-hover:text-orange-500 transition-colors uppercase tracking-tight">
                                    {post.user?.username || "anonymous"}
                                </p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Digital Architect</p>
                            </div>
                        </Link>

                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Timestamp</p>
                            <p className="text-xs font-bold text-white/70">
                                {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    {/* Integrated Post Component for Actions & Comments */}
                    <div className="bg-[#121212] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        {/* We use a modified version of FeedPost layout here or just the component itself */}
                        <FeedPost post={post} onLikeToggle={handleLikeToggle} />
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">Signal Strength</p>
                            <p className="text-2xl font-black text-orange-500">{post.like_count}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">Echoes</p>
                            <p className="text-2xl font-black text-white">{post.comment_count}</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10 mt-12 text-center text-gray-600">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Broadcast ID: {post.id}</p>
                <div className="mt-4 flex justify-center gap-6 text-xs font-bold">
                    <Link href="/feed" className="hover:text-white transition-colors">Global Feed</Link>
                    <Link href="/communities" className="hover:text-white transition-colors">Communities</Link>
                    <Link href="/profile" className="hover:text-white transition-colors">Identity</Link>
                </div>
            </footer>
        </div>
    );
}
