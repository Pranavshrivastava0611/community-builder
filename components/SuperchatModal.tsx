"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction
} from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toast } from "react-hot-toast";
import GlowButton from "./GlowButton";

interface SuperchatModalProps {
    isOpen: boolean;
    onClose: () => void;
    communityId: string;
    recipientWallet: string;
}

export default function SuperchatModal({ isOpen, onClose, communityId, recipientWallet }: SuperchatModalProps) {
    const [amount, setAmount] = useState<string>("0.1");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const handleSend = async () => {
        if (!publicKey) {
            toast.error("Please connect your wallet");
            return;
        }

        try {
            setLoading(true);
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new PublicKey(recipientWallet),
                    lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
                })
            );

            const signature = await sendTransaction(transaction, connection);

            // Send to backend after confirmation
            const token = localStorage.getItem("authToken");
            const res = await fetch("/api/chat/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    communityId,
                    messages: [message || `Sent ${amount} SOL Superchat!`],
                    type: "text",
                    is_superchat: true,
                    superchat_amount: parseFloat(amount),
                    tx_signature: signature
                })
            });

            if (res.ok) {
                toast.success("Superchat Transmitted!");
                onClose();
            } else {
                toast.error("Signal recorded but chat failed to sync");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Transaction failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-[#0a0a0a] border border-yellow-500/30 rounded-[32px] p-8 shadow-[0_0_50px_rgba(234,179,8,0.1)]"
                    >
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                                <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Hypercharge Signal</h2>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Boost your presence with a Superchat</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2">Select Amount (SOL)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {["0.1", "0.5", "1.0", "5.0", "10.0", "25.0"].map((v) => (
                                        <button
                                            key={v}
                                            onClick={() => setAmount(v)}
                                            className={`py-3 rounded-xl border font-bold text-sm transition-all ${amount === v
                                                    ? "bg-yellow-500 text-black border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                                                    : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20"
                                                }`}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2">Message (Optional)</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Enter a message to highlight..."
                                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-yellow-500/50 h-24"
                                />
                            </div>

                            <GlowButton
                                onClick={handleSend}
                                disabled={loading}
                                className="w-full py-4 text-sm bg-yellow-500 border-yellow-400"
                            >
                                {loading ? "Transmitting..." : `Amplify Signal for ${amount} SOL`}
                            </GlowButton>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
