"use client";

import { supabase } from "@/utils/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import GlowButton from "./GlowButton";

interface CreatePostProps {
    communityId?: string;
    onPostCreated: (post: any) => void;
    isMember?: boolean;
}

interface CommunitySimple {
    id: string;
    name: string;
    image_url?: string;
}

export default function CreatePost({ communityId, onPostCreated, isMember = true }: CreatePostProps) {
    const [content, setContent] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [posting, setPosting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showImageInput, setShowImageInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Selector Logic
    const [myCommunities, setMyCommunities] = useState<CommunitySimple[]>([]);
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>(communityId || "");
    const [loadingContext, setLoadingContext] = useState(!communityId);

    useEffect(() => {
        if (communityId) {
            setSelectedCommunityId(communityId);
            setLoadingContext(false);
        } else {
            const fetchCommunities = async () => {
                try {
                    const token = localStorage.getItem("authToken");
                    if (!token) return;
                    const res = await fetch("/api/user/communities", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.communities) {
                        setMyCommunities(data.communities);
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `post-media/${fileName}`;

            const { data, error } = await supabase.storage
                .from('posts')
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('posts')
                .getPublicUrl(filePath);

            setImageUrl(publicUrl);
            setShowImageInput(true);
            toast.success("File uploaded!");
        } catch (error: any) {
            toast.error("Upload failed: " + error.message);
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCommunityId || (!content.trim() && !imageUrl)) return;

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
                body: JSON.stringify({
                    communityId: selectedCommunityId,
                    content,
                    imageUrl: imageUrl.trim() || null
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed");
            }

            const data = await res.json();
            const createdPost = data.post;

            if (!createdPost.community && !communityId) {
                const comm = myCommunities.find(c => c.id === selectedCommunityId);
                createdPost.community = comm;
            }

            onPostCreated(createdPost);
            setContent("");
            setImageUrl("");
            setShowImageInput(false);
            toast.success("Posted successfully!");

        } catch (error: any) {
            toast.error(error.message || "Failed to post");
        } finally {
            setPosting(false);
        }
    };

    if (communityId && !isMember) {
        return (
            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl text-center text-gray-500 mb-8 italic">
                Join this community to share your thoughts.
            </div>
        );
    }

    if (!communityId && !loadingContext && myCommunities.length === 0) {
        return (
            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl text-center text-gray-500 mb-8 italic">
                Discover and join communities to start posting!
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl mb-8 shadow-2xl relative group overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />

            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-xl font-black text-white tracking-tight">Create Post</h3>

                {!communityId && myCommunities.length > 0 && (
                    <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-2xl border border-white/10">
                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Post to</span>
                        <select
                            value={selectedCommunityId}
                            onChange={(e) => setSelectedCommunityId(e.target.value)}
                            className="bg-transparent text-sm text-orange-400 font-bold focus:outline-none cursor-pointer"
                        >
                            {myCommunities.map(c => (
                                <option key={c.id} value={c.id} className="bg-neutral-900">{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <form onSubmit={handlePost} className="relative z-10">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={!communityId ? "What's on your mind?" : `Message to ${communityId}...`}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/40 transition-all min-h-[120px] mb-4 text-lg resize-none"
                    disabled={posting}
                />

                <AnimatePresence>
                    {showImageInput && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 space-y-4"
                        >
                            <input
                                type="text"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="Paste image URL here..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                            {imageUrl && (
                                <div className="relative group/img rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black/20">
                                    <img
                                        src={imageUrl}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                        onError={() => toast.error("Invalid image URL")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setImageUrl("")}
                                        className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex justify-between items-center bg-black/20 p-2 rounded-3xl border border-white/5">
                    <div className="flex gap-1">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="image/*,video/*"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className={`p-3 rounded-2xl transition-all ${uploading ? 'bg-orange-500/10 text-orange-500 animate-pulse' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            {uploading ? (
                                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowImageInput(!showImageInput)}
                            className={`p-3 rounded-2xl transition-all ${showImageInput ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            title="Paste URL instead"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        </button>
                    </div>

                    <GlowButton type="submit" disabled={posting || uploading || (!content.trim() && !imageUrl) || !selectedCommunityId} className="px-10 py-3 rounded-2xl">
                        {posting ? "Posting..." : "Share Post"}
                    </GlowButton>
                </div>
            </form>
        </motion.div>
    );
}
