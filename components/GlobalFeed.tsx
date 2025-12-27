"use client";

import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import CreatePost from "./CreatePost";
import FeedPost from "./FeedPost";

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
        token_symbol?: string;
    };
}

export default function GlobalFeed() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFeed() {
            try {
                const token = localStorage.getItem("authToken");
                const headers: any = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch(`/api/feed/global`, { headers });
                const data = await res.json();
                if (data.posts) {
                    setPosts(data.posts);
                }
            } catch (e) {
                console.error("Failed to load global feed", e);
            } finally {
                setLoading(false);
            }
        }
        fetchFeed();

        // Realtime Subscription
        const channel = supabase
            .channel('global-feed-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'posts' },
                async (payload) => {
                    console.log('New post received via realtime:', payload);
                    // Fetch full post details because the realtime payload only contains the base row
                    const { data: fullPost, error } = await supabase
                        .from('posts')
                        .select(`
                            *,
                            author:profiles(username, avatar_url),
                            community:communities(name, image_url),
                            comments(count)
                        `)
                        .eq('id', payload.new.id)
                        .single();

                    if (fullPost && !error) {
                        const formattedPost = {
                            ...fullPost,
                            user: fullPost.author,
                            user_id: fullPost.author_id,
                            like_count: fullPost.like_count || 0,
                            comment_count: fullPost.comments?.[0]?.count || 0,
                            isLiked: false
                        };
                        setPosts(prev => [formattedPost, ...prev]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

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
    };

    if (loading) {
        return <div className="text-center py-10 text-gray-500 animate-pulse">Loading global feed...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold text-white mb-8 bg-gradient-to-r from-orange-400 to-amber-200 bg-clip-text text-transparent">
                Global Community Feed
            </h1>

            <CreatePost onPostCreated={(newPost: any) => setPosts(prev => [newPost, ...prev])} />

            <div className="space-y-4">
                {posts.map(post => (
                    <FeedPost key={post.id} post={post} onLikeToggle={handleLikeToggle} />
                ))}
                {posts.length === 0 && (
                    <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
                        <p className="text-gray-400 text-lg">No posts yet across the ecosystem.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
