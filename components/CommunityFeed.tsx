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
}

interface CommunityFeedProps {
    communityId: string;
    isMember: boolean;
}

export default function CommunityFeed({ communityId, isMember }: CommunityFeedProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFeed() {
            try {
                const token = localStorage.getItem("authToken");
                const headers: any = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch(`/api/feed/${communityId}`, { headers });
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

        // Realtime Subscription
        const channel = supabase
            .channel(`community-feed-${communityId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'posts',
                    filter: `community_id=eq.${communityId}`
                },
                async (payload) => {
                    console.log('New community post received via realtime:', payload);
                    // Fetch full post details
                    const { data: fullPost, error } = await supabase
                        .from('posts')
                        .select(`
                            *,
                            author:profiles(username, avatar_url),
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
                        setPosts(prev => {
                            // Avoid duplicates (if locally created post also triggers subscription)
                            if (prev.some(p => p.id === formattedPost.id)) return prev;
                            return [formattedPost, ...prev];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [communityId]);

    const handlePostCreated = (newPost: any) => {
        // Add new post to top (include user mock if response doesn't have it, but usually backend response might lack join info immediately if insert didn't return joined data)
        // Actually backend response `post` is the row.
        // We might want to inject current user profile or refetch.
        // For MVP we just add it.
        setPosts(prev => [newPost, ...prev]);
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
    };

    if (loading) {
        return <div className="text-center py-10 text-gray-500 animate-pulse">Loading feed...</div>;
    }

    return (
        <div>
            <CreatePost communityId={communityId} isMember={isMember} onPostCreated={handlePostCreated} />

            <div className="space-y-4">
                {posts.map(post => (
                    <FeedPost key={post.id} post={post} onLikeToggle={handleLikeToggle} />
                ))}
                {posts.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        No posts yet. Be the first to start the conversation!
                    </div>
                )}
            </div>
        </div>
    );
}
