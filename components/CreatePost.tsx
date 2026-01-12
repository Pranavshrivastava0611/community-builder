"use client";

import { supabase } from "@/utils/supabase";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import GlowButton from "./GlowButton";
import SwapPortal from "./SwapPortal";

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
    const [tags, setTags] = useState<string[]>([]);
    const [isNsfw, setIsNsfw] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Selector Logic
    const [myCommunities, setMyCommunities] = useState<CommunitySimple[]>([]);
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>(communityId || "");
    const [loadingContext, setLoadingContext] = useState(!communityId);
    const { connection } = useConnection();
    const { publicKey, connected } = useWallet();

    // Token Gating State
    const [hasToken, setHasToken] = useState<boolean | null>(null);
    const [checkingToken, setCheckingToken] = useState(false);
    const [communityMeta, setCommunityMeta] = useState<any>(null);
    const [showSwap, setShowSwap] = useState(false);

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

    async function verifyAccess() {
        if (!selectedCommunityId || !connected || !publicKey) {
            setHasToken(null);
            return;
        }

        setCheckingToken(true);
        try {
            // 1. Fetch community metadata (mint/pool)
            const res = await fetch(`/api/communities/id/${selectedCommunityId}`);
            const { community } = await res.json();
            setCommunityMeta(community);

            if (community?.token_mint_address && publicKey) {
                const mint = new PublicKey(community.token_mint_address);
                const owner = publicKey as PublicKey;
                const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });

                const balance = accounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
                setHasToken(balance > 0);
            } else {
                setHasToken(true); // No token required for this community
            }
        } catch (e) {
            console.error("Access verification failed", e);
            setHasToken(true); // Fallback to allow posting if check fails
        } finally {
            setCheckingToken(false);
        }
    }

    // Balance Verification Logic
    useEffect(() => {
        verifyAccess();
    }, [selectedCommunityId, publicKey, connected, connection]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const isVideo = file.type.startsWith('video/');
            const bucketName = isVideo ? 'video' : 'images';
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${isVideo ? 'video' : 'image'}-media/${fileName}`;

            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            setImageUrl(publicUrl);
            setShowImageInput(true);
            toast.success(`${isVideo ? 'Video' : 'Image'} uploaded!`);
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
                    imageUrl: imageUrl.trim() || null,
                    tags,
                    isNsfw
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
            setTags([]);
            setIsNsfw(false);
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
        <div className="relative">
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
                                {(myCommunities || []).map(c => (
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
                        placeholder={(hasToken === false) ? "RESTRICED: ACCESS KEY REQUIRED" : (!communityId ? "What's on your mind?" : `Message to ${communityId}...`)}
                        className={`w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/40 transition-all min-h-[120px] mb-4 text-lg resize-none ${hasToken === false ? 'opacity-30 blur-sm pointer-events-none' : ''}`}
                        disabled={posting || hasToken === false}
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
                                        {(imageUrl.match(/\.(mp4|webm|ogg)$/i) || imageUrl.includes('video-media')) ? (
                                            <video
                                                src={imageUrl}
                                                controls
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <img
                                                src={imageUrl}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                                onError={() => toast.error("Invalid image URL")}
                                            />
                                        )}
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

                    {/* Tag Selection & NSFW Toggle */}
                    <div className="flex flex-wrap items-center gap-3 mb-6 px-1">
                        <div
                            onClick={() => setIsNsfw(!isNsfw)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${isNsfw ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}
                        >
                            <span className="text-[9px] font-black uppercase tracking-widest">NSFW</span>
                        </div>

                        {["NFT", "Solana", "Meme", "Dev", "General"].map(tag => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                    if (tags.includes(tag)) setTags(tags.filter(t => t !== tag));
                                    else setTags([...tags, tag]);
                                }}
                                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${tags.includes(tag) ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}
                            >
                                {tag}
                            </button>
                        ))}

                        <div className="flex items-center bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[9px] focus-within:border-orange-500/50 transition-all">
                            <span className="text-gray-600 mr-2">#</span>
                            <input
                                type="text"
                                placeholder="CUSTOM"
                                className="bg-transparent text-white font-black uppercase tracking-widest focus:outline-none w-16"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim().toUpperCase();
                                        if (val && !tags.includes(val)) {
                                            setTags([...tags, val]);
                                            e.currentTarget.value = "";
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-3xl border border-white/5 overflow-hidden relative">
                        {hasToken === false && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-20 flex items-center justify-between px-6">
                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                    Token Required
                                </span>
                                <button
                                    onClick={(e) => { e.preventDefault(); setShowSwap(true); }}
                                    className="px-4 py-2 bg-orange-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-[0_5px_15px_rgba(249,115,22,0.4)] hover:scale-105 active:scale-95 transition-all"
                                >
                                    Get Token to Post
                                </button>
                            </div>
                        )}

                        <div className={`flex gap-1 ${hasToken === false ? 'opacity-10 pointer-events-none' : ''}`}>
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656 0l4-4a4 4 0 10-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </button>
                        </div>

                        <GlowButton type="submit" disabled={posting || uploading || (!content.trim() && !imageUrl) || !selectedCommunityId || hasToken === false} className="px-10 py-3 rounded-2xl">
                            {posting ? "Posting..." : "Share Post"}
                        </GlowButton>
                    </div>
                </form>

                {checkingToken && (
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                        <span className="text-[8px] font-black uppercase text-gray-700 tracking-widest">Verifying Access...</span>
                    </div>
                )}
            </motion.div>

            {/* Swap Modal Integration */}
            {communityMeta && (
                <SwapPortal
                    isOpen={showSwap}
                    onClose={() => setShowSwap(false)}
                    onSuccess={verifyAccess}
                    lbPairAddress={communityMeta.meteora_lb_pair_address}
                    tokenMint={communityMeta.token_mint_address}
                    tokenSymbol={communityMeta.name?.substring(0, 4).toUpperCase()}
                    communityName={communityMeta.name}
                />
            )}
        </div>
    );
}
