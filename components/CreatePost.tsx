"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import GlowButton from "./GlowButton";

interface CreatePostProps {
    communityId?: string; // Optional if selecting from dropdown
    onPostCreated: (post: any) => void;
    isMember?: boolean; // If providing a specific communityId, pass isMember. If global, we check auth/memberships list.
}

interface CommunitySimple {
    id: string;
    name: string;
    image_url?: string;
}

export default function CreatePost({ communityId, onPostCreated, isMember = true }: CreatePostProps) {
    const [content, setContent] = useState("");
    const [posting, setPosting] = useState(false);

    // Selector Logic
    const [myCommunities, setMyCommunities] = useState<CommunitySimple[]>([]);
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>(communityId || "");
    const [loadingContext, setLoadingContext] = useState(!communityId); // If no ID passed, we load context

    useEffect(() => {
        // If communityId passed, update state
        if (communityId) {
            setSelectedCommunityId(communityId);
            setLoadingContext(false);
        } else {
            // Fetch user communities
            const fetchCommunities = async () => {
                try {
                    const token = localStorage.getItem("authToken");
                    if (!token) return; // Not logged in
                    const res = await fetch("/api/user/communities", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.communities) {
                        setMyCommunities(data.communities);
                        // Select first one by default?
                        if (data.communities.length > 0) setSelectedCommunityId(data.communities[0].id);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingContext(false);
                }
            };
            fetchCommunities();
        }
    }, [communityId]);

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !selectedCommunityId) return;

        setPosting(true);
        try {
            const token = localStorage.getItem("authToken");
            if (!token) {
                toast.error("Please login");
                return;
            }

            const res = await fetch("/api/feed/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ communityId: selectedCommunityId, content })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed");
            }

            const data = await res.json();
            const createdPost = data.post;

            // Inject community info if missing (for Global Feed display)
            if (!createdPost.community && !communityId) {
                const comm = myCommunities.find(c => c.id === selectedCommunityId);
                createdPost.community = comm;
            }

            onPostCreated(createdPost);
            setContent("");
            toast.success("Posted to feed!");

        } catch (error: any) {
            toast.error(error.message || "Failed to post");
        } finally {
            setPosting(false);
        }
    };

    // If specific community provided but not member
    if (communityId && !isMember) {
        return (
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-center text-gray-400 mb-8">
                Join this community to post updates.
            </div>
        );
    }

    // If global mode but user has no communities (and loaded)
    if (!communityId && !loadingContext && myCommunities.length === 0) {
        return (
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-center text-gray-400 mb-8">
                Join a community to start posting!
            </div>
        );
    }

    return (
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md mb-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Post an update</h3>

                {!communityId && myCommunities.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Post to:</span>
                        <select
                            value={selectedCommunityId}
                            onChange={(e) => setSelectedCommunityId(e.target.value)}
                            className="bg-black/40 border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-orange-500"
                        >
                            {myCommunities.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <form onSubmit={handlePost}>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={!communityId ? "Select a community and share your thoughts..." : "What's up?"}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 transition-all min-h-[100px] mb-4"
                    disabled={posting}
                />
                <div className="flex justify-end">
                    <GlowButton type="submit" disabled={posting || !content.trim() || !selectedCommunityId} className="px-8">
                        {posting ? "Posting..." : "Post"}
                    </GlowButton>
                </div>
            </form>
        </div>
    );
}
