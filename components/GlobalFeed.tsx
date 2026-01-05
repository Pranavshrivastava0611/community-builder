"use client";

import { supabase } from "@/utils/supabase";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import FeedPost from "./FeedPost";
import NotificationsPopover from "./NotificationsPopover";
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
        token_symbol?: string;
    };
}

interface Community {
    id: string;
    name: string;
    image_url?: string;
}

interface UserProfile {
    id: string;
    username: string;
    avatar_url?: string;
    public_key: string;
}

export default function GlobalFeed() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [feedMode, setFeedMode] = useState<'global' | 'friends'>('global');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch(`/api/feed/${feedMode}`, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.posts) setPosts(data.posts);
        } catch (error) {
            console.error("Fetch feed error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        async function fetchInitialData() {
            try {
                // Fetch communities for recommendations
                const cRes = await fetch("/api/communities");
                const cData = await cRes.json();
                if (cData.communities) {
                    setRecommendations(cData.communities.slice(0, 5));
                }

                // Fetch user profile if logged in
                const token = localStorage.getItem("authToken");
                if (token) {
                    const pRes = await fetch("/api/profile", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const pData = await pRes.json();
                    if (pData.profile) setUserProfile(pData.profile);
                }

                await fetchFeed();
            } catch (error) {
                console.error("Initial load error:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchInitialData();
    }, [feedMode]);

    // Search State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Community[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const { disconnect } = useWallet();
    const { setVisible } = useWalletModal();

    useEffect(() => {
        async function fetchCounts() {
            try {
                const token = localStorage.getItem("authToken");
                if (!token) return;

                // Fetch unread notifications
                const nRes = await fetch("/api/notifications", { headers: { "Authorization": `Bearer ${token}` } });
                const nData = await nRes.json();
                setUnreadNotifications(nData.notifications?.filter((n: any) => !n.is_read).length || 0);

                // Fetch unread messages
                const mRes = await fetch("/api/messages/conversations", { headers: { "Authorization": `Bearer ${token}` } });
                const mData = await mRes.json();
                // For MVP we just check if any conversation has unread (simplified)
                setUnreadMessages(0); // placeholder for more complex logic
            } catch (e) { }
        }
        fetchCounts();
        async function fetchSuggestions() {
            try {
                const token = localStorage.getItem("authToken");
                const headers: any = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch('/api/user/suggestions', { headers });
                const data = await res.json();
                if (data.communities) setRecommendations(data.communities);
            } catch (e) {
                console.error("Failed to fetch suggestions", e);
            }
        }

        async function fetchProfile() {
            try {
                const token = localStorage.getItem("authToken");
                if (!token) return;
                const res = await fetch('/api/profile', {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.profile) setUserProfile(data.profile);
            } catch (e) {
                console.error("Failed to fetch profile", e);
            }
        }

        fetchSuggestions();
        fetchProfile();

        const channel = supabase
            .channel('global-feed-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload: any) => {
                const { data: fullPost } = await supabase
                    .from('posts')
                    .select(`*, author:profiles(username, avatar_url), community:communities(name, image_url), comments(count), media(file_url)`)
                    .eq('id', payload.new.id)
                    .single();

                if (fullPost) {
                    const author = Array.isArray(fullPost.author) ? fullPost.author[0] : fullPost.author;
                    const community = Array.isArray(fullPost.community) ? fullPost.community[0] : fullPost.community;

                    const formatted = {
                        ...fullPost,
                        user: author,
                        user_id: fullPost.author_id,
                        community: community,
                        like_count: fullPost.like_count || 0,
                        comment_count: Array.isArray(fullPost.comments) ? (fullPost.comments[0]?.count || 0) : (fullPost.comments?.count || 0),
                        image_url: Array.isArray(fullPost.media) ? (fullPost.media[0]?.file_url || null) : (fullPost.media?.file_url || null),
                        isLiked: false
                    };
                    setPosts(prev => {
                        if (prev.some(p => p.id === formatted.id)) return prev;
                        return [formatted, ...prev];
                    });
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload: any) => {
                setPosts(prev => prev.map(p =>
                    p.id === payload.new.id
                        ? { ...p, like_count: payload.new.like_count }
                        : p
                ));
            })
            .on('broadcast', { event: 'post-update' }, (payload: any) => {
                if (payload.payload?.id) {
                    setPosts(prev => prev.map(p =>
                        p.id === payload.payload.id ? { ...p, like_count: payload.payload.like_count } : p
                    ));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (!userProfile?.id) return;

        const channel = supabase
            .channel(`user-specific-${userProfile.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userProfile.id}`
            }, () => {
                setUnreadNotifications(prev => prev + 1);
                toast.success("New activity received!", {
                    style: {
                        background: '#000',
                        color: '#fff',
                        border: '1px solid #333'
                    }
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userProfile?.id]);

    // Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('communities')
                    .select('id, name, image_url')
                    .ilike('name', `%${searchQuery}%`)
                    .limit(5);

                if (data) setSearchResults(data);
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleLikeToggle = (postId: string, newLiked: boolean) => {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: newLiked, like_count: newLiked ? p.like_count + 1 : Math.max(0, p.like_count - 1) } : p));
    };

    const handleDetailView = (post: Post) => {
        setSelectedPost(post);
        setIsPostModalOpen(true);
    };

    const handleSwitchWallet = async () => {
        await disconnect();
        localStorage.removeItem("authToken");
        setVisible(true);
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-white/50 bg-black">Loading Experience...</div>;

    return (
        <div className="flex bg-black min-h-screen">
            {/* Left Sidebar (Instagram Style) */}
            <div className="w-[80px] lg:w-[240px] border-r border-white/10 h-screen sticky top-0 p-4 flex flex-col items-center lg:items-start">
                <div className="mb-10 mt-4 px-2">
                    <h1 className="text-xl font-black lg:block hidden tracking-tighter">SOLANA<span className="text-orange-500 text-sm">COMMUNITY</span></h1>
                    <div className="lg:hidden w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-black">S</div>
                </div>

                <nav className="flex flex-col gap-6 w-full">
                    <Link href="/feed" className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-white">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        <span className="hidden lg:block font-bold">Home</span>
                    </Link>

                    <button onClick={() => setIsSearchOpen(true)} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <span className="hidden lg:block font-bold">Explore</span>
                    </button>

                    <Link href="/messages" className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white relative">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        <span className="hidden lg:block font-bold">Inbox</span>
                        {unreadMessages > 0 && <span className="absolute top-2 left-8 w-2 h-2 bg-orange-500 rounded-full" />}
                    </Link>

                    <button onClick={() => { setIsNotificationsOpen(true); setUnreadNotifications(0); }} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white relative">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        <span className="hidden lg:block font-bold">Notifications</span>
                        {unreadNotifications > 0 && <span className="absolute top-2 left-8 w-2.5 h-2.5 bg-orange-600 rounded-full border-2 border-black animate-pulse" />}
                    </button>

                    <Link href="/communities" className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        <span className="hidden lg:block font-bold">Create</span>
                    </Link>
                </nav>

                <div className="mt-auto mb-6 w-full">
                    <Link href="/profile" className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 p-[1.5px]">
                            <div className="w-full h-full rounded-full bg-black border border-black/50 overflow-hidden relative">
                                <img
                                    src={userProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.username || 'guest'}`}
                                    className="w-full h-full object-cover"
                                    alt=""
                                />
                            </div>
                        </div>
                        <span className="hidden lg:block font-bold">Profile</span>
                    </Link>
                </div>
            </div>

            {/* Middle Content */}
            <div className="flex-1 flex flex-col items-center">
                <main className="w-full max-w-[630px] pt-8">
                    {/* Feed Tabs */}
                    <div className="flex items-center justify-center border-b border-white/5 mb-10 sticky top-0 bg-black/80 backdrop-blur-xl z-30">
                        <button
                            onClick={() => setFeedMode('global')}
                            className={`px-10 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${feedMode === 'global' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            For You
                            {feedMode === 'global' && <motion.div layoutId="feedTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500" />}
                        </button>
                        <button
                            onClick={() => setFeedMode('friends')}
                            className={`px-10 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${feedMode === 'friends' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Friends
                            {feedMode === 'friends' && <motion.div layoutId="feedTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500" />}
                        </button>
                    </div>

                    {/* Posts Section */}
                    <div className="flex flex-col gap-8">
                        {(() => {
                            // Ensure unique posts before rendering (safety net)
                            const uniquePosts = posts.filter((post, index, self) =>
                                index === self.findIndex(p => p.id === post.id)
                            );

                            return uniquePosts.map(post => (
                                <FeedPost
                                    key={post.id}
                                    post={post}
                                    onLikeToggle={handleLikeToggle}
                                    onDetailView={handleDetailView}
                                />
                            ));
                        })()}
                        {posts.length === 0 && (
                            <div className="text-center py-40 text-gray-600">
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter">
                                    {feedMode === 'global' ? "Nothing Here Yet" : "Your Circle is Quiet"}
                                </h2>
                                <p className="text-xs font-medium mt-2 max-w-[280px] mx-auto leading-relaxed">
                                    {feedMode === 'global'
                                        ? "Join communities on the right to start seeing the latest on-chain activity."
                                        : "Add friends to see their private updates and shared content."}
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Right Sidebar Suggestions */}
            <div className="hidden xl:flex w-[350px] flex-col p-10 sticky top-0 h-screen">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 p-[1.5px]">
                            <div className="w-full h-full rounded-full bg-black border border-white/10 overflow-hidden relative">
                                <img
                                    src={userProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.username || 'guest'}`}
                                    className="w-full h-full object-cover"
                                    alt=""
                                />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-black text-white">{userProfile?.username || "Guest User"}</p>
                            <p className="text-xs text-gray-500">{userProfile ? "Active Member" : "Explore Solana"}</p>
                        </div>
                    </div>
                    <button onClick={handleSwitchWallet} className="text-xs font-black text-blue-500 hover:text-white transition-colors">Switch</button>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-black text-gray-500">Suggested for you</span>
                    <button className="text-xs font-black text-white">See All</button>
                </div>

                <div className="flex flex-col gap-5">
                    {recommendations.slice(0, 3).map((c) => (
                        <div key={c.id} className="flex items-center justify-between group">
                            <Link href={`/communities/${c.name}`} className="flex items-center gap-4">
                                <img
                                    src={c.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`}
                                    alt=""
                                    className="w-10 h-10 rounded-full bg-neutral-800 border border-white/5 group-hover:scale-110 transition-transform"
                                />
                                <div>
                                    <p className="text-sm font-black text-white hover:underline">{c.name}</p>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">New Community</p>
                                </div>
                            </Link>
                            <button className="text-xs font-black text-blue-500 hover:text-white">Follow</button>
                        </div>
                    ))}
                    {recommendations.length === 0 && (
                        <p className="text-xs text-gray-600 font-bold text-center py-4 italic">No new suggestions</p>
                    )}
                </div>

                <div className="text-[11px] text-gray-600 leading-normal uppercase font-black tracking-widest mt-auto mb-4">
                    About · Help · Press · API · Jobs · Privacy · Terms · Locations · Language · Meta Verified
                </div>
                <div className="text-[11px] text-gray-700 font-black">© 2025 SOLANA COMMUNITY FROM METEORA</div>
            </div>

            {/* Search Overlay */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-[150] flex items-start justify-center pt-20 px-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsSearchOpen(false)} />
                    <div className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <div className="flex items-center gap-4 bg-white/5 rounded-2xl px-4 py-3 border border-white/10 focus-within:border-orange-500/50 transition-colors">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search communities..."
                                    className="bg-transparent flex-1 text-white outline-none font-bold placeholder:text-gray-600"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {isSearching && <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
                            {searchQuery.length > 1 ? (
                                searchResults.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                        {searchResults.map(c => (
                                            <Link
                                                key={c.id}
                                                href={`/communities/${c.name}`}
                                                onClick={() => setIsSearchOpen(false)}
                                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group"
                                            >
                                                <img
                                                    src={c.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`}
                                                    className="w-12 h-12 rounded-full bg-neutral-800"
                                                    alt=""
                                                />
                                                <div>
                                                    <p className="font-bold text-white group-hover:text-orange-500 transition-colors">{c.name}</p>
                                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Community</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    !isSearching && <div className="text-center py-10 text-gray-500 font-bold italic">No communities found matching "{searchQuery}"</div>
                                )
                            ) : (
                                <div className="text-center py-10 text-gray-500 font-bold italic">Type at least 2 characters to search...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {isNotificationsOpen && (
                    <NotificationsPopover onClose={() => setIsNotificationsOpen(false)} />
                )}
            </AnimatePresence>

            <PostModal
                post={selectedPost}
                isOpen={isPostModalOpen}
                onClose={() => setIsPostModalOpen(false)}
                onLikeToggle={handleLikeToggle}
            />
        </div>
    );
}
