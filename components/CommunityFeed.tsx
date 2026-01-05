"use client";

import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import CreatePost from "./CreatePost";
import FeedPost from "./FeedPost";
import PostModal from "./PostModal";

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

interface CommunityFeedProps {
    communityId: string;
    isMember: boolean;
}

export default function CommunityFeed({ communityId, isMember }: CommunityFeedProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [realtimeStatus, setRealtimeStatus] = useState<string>("connecting");
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);

    useEffect(() => {
        async function fetchFeed() {
            try {
                const token = localStorage.getItem("authToken");
                const headers: any = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch(`/api/feed/${communityId}`, {
                    headers,
                    cache: 'no-store'
                });
                const data = await res.json();
                if (data.posts) {
                    setPosts(data.posts);
                }
            } catch (e) {
                console.error("Failed to load feed", e);
            } finally {
                setLoading(false);
            }
        }
        fetchFeed();
    }, [communityId]);

    useEffect(() => {
        if (!supabase) return;

        const channel = supabase
            .channel(`community-feed-${communityId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'posts'
                },
                async (payload) => {
                    if (payload.new && payload.new.community_id !== communityId) return;

                    if (payload.eventType === 'INSERT') {
                        const { data: fullPost } = await supabase
                            .from('posts')
                            .select(`*, author:profiles(username, avatar_url), comments(count), media(file_url)`)
                            .eq('id', payload.new.id)
                            .single();

                        if (fullPost) {
                            const author = Array.isArray(fullPost.author) ? fullPost.author[0] : fullPost.author;
                            const formattedPost = {
                                ...fullPost,
                                user: author,
                                user_id: fullPost.author_id,
                                like_count: fullPost.like_count || 0,
                                comment_count: Array.isArray(fullPost.comments) ? (fullPost.comments[0]?.count || 0) : (fullPost.comments?.count || 0),
                                image_url: Array.isArray(fullPost.media) ? (fullPost.media[0]?.file_url || null) : (fullPost.media?.file_url || null),
                                isLiked: false
                            };
                            setPosts(prev => {
                                if (prev.some(p => p.id === formattedPost.id)) return prev;
                                return [formattedPost, ...prev];
                            });
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        setPosts(prev => prev.map(p =>
                            p.id === payload.new.id ? { ...p, like_count: payload.new.like_count } : p
                        ));
                        if (selectedPost?.id === payload.new.id) {
                            setSelectedPost(prev => prev ? { ...prev, like_count: payload.new.like_count } : null);
                        }
                    }
                }
            )
            .on('broadcast', { event: 'post-update' }, (payload: any) => {
                if (payload.payload?.id) {
                    setPosts(prev => prev.map(p =>
                        p.id === payload.payload.id ? { ...p, like_count: payload.payload.like_count } : p
                    ));
                    if (selectedPost?.id === payload.payload.id) {
                        setSelectedPost(prev => prev ? { ...prev, like_count: payload.payload.like_count } : null);
                    }
                }
            })
            .subscribe((status) => {
                setRealtimeStatus(status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [communityId, selectedPost]);

    const handlePostCreated = (newPost: any) => {
        setPosts(prev => {
            if (prev.some(p => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
        });
    };

    const handleLikeToggle = (postId: string, newLiked: boolean) => {
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return {
                    ...p,
                    isLiked: newLiked,
                    like_count: newLiked ? p.like_count + 1 : Math.max(0, p.like_count - 1)
                };
            }
            return p;
        }));
        if (selectedPost?.id === postId) {
            setSelectedPost(prev => prev ? {
                ...prev,
                isLiked: newLiked,
                like_count: newLiked ? prev.like_count + 1 : Math.max(0, prev.like_count - 1)
            } : null);
        }
    };

    const handleDetailView = (post: Post) => {
        setSelectedPost(post);
        setIsPostModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Syncing Community Feed...</p>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="absolute -top-12 right-0 flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <div className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <span className="text-[8px] font-black uppercase tracking-tighter text-gray-400">
                    {realtimeStatus === 'SUBSCRIBED' ? 'Live' : 'Degraded'}
                </span>
            </div>

            <CreatePost communityId={communityId} isMember={isMember} onPostCreated={handlePostCreated} />

            <div className="space-y-4">
                {posts.map(post => (
                    <FeedPost
                        key={post.id}
                        post={post}
                        onLikeToggle={handleLikeToggle}
                        onDetailView={handleDetailView}
                    />
                ))}
                {posts.length === 0 && (
                    <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                        <p className="text-gray-500 font-bold italic">No signals yet. Start the chain!</p>
                    </div>
                )}
            </div>

            <PostModal
                post={selectedPost}
                isOpen={isPostModalOpen}
                onClose={() => setIsPostModalOpen(false)}
                onLikeToggle={handleLikeToggle}
            />
        </div>
    );
}
