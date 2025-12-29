"use client";

import DLMM from "@meteora-ag/dlmm";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
//@ts-ignore
import BN from "bn.js";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface SwapPortalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    lbPairAddress: string;
    tokenMint: string;
    tokenSymbol?: string;
    communityName?: string;
}

export default function SwapPortal({
    isOpen,
    onClose,
    onSuccess,
    lbPairAddress,
    tokenMint,
    tokenSymbol = "TOKEN",
    communityName = "this community",
}: SwapPortalProps) {
    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();

    const [inAmount, setInAmount] = useState("");
    const [outAmount, setOutAmount] = useState("0");
    const [loadingPool, setLoadingPool] = useState(true);
    const [swapping, setSwapping] = useState(false);
    const [pool, setPool] = useState<any>(null);

    /* ---------------- LOAD DLMM POOL ---------------- */
    useEffect(() => {
        if (!isOpen || !lbPairAddress) return;

        async function loadPool() {
            setLoadingPool(true);
            try {
                const cluster = connection.rpcEndpoint.includes("devnet")
                    ? "devnet"
                    : "mainnet-beta";

                const dlmmPool = await DLMM.create(
                    connection,
                    new PublicKey(lbPairAddress),
                    { cluster }
                );

                setPool(dlmmPool);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load liquidity pool");
            } finally {
                setLoadingPool(false);
            }
        }

        loadPool();
    }, [isOpen, lbPairAddress, connection]);

    /* ---------------- LIVE QUOTE ---------------- */
    useEffect(() => {
        if (!pool || !inAmount || isNaN(parseFloat(inAmount)) || parseFloat(inAmount) <= 0) {
            setOutAmount("0");
            return;
        }

        const updateQuote = async () => {
            try {
                const WSOL_ADDR = "So11111111111111111111111111111111111111112";
                const isXSOL = pool.tokenX.publicKey.toBase58() === WSOL_ADDR;
                const inTokenInfo = isXSOL ? pool.tokenX : pool.tokenY;
                const outTokenInfo = isXSOL ? pool.tokenY : pool.tokenX;

                const decimals = inTokenInfo.decimals || 9;
                const outDecimals = outTokenInfo.decimals || 9;

                // Precision-safe conversion using BigInt to avoid scientific notation
                const amountFloat = parseFloat(inAmount);
                const rawAmountStr = BigInt(Math.floor(amountFloat * Math.pow(10, decimals))).toString();
                const amountInBN = new BN(rawAmountStr);

                // Fetch bin arrays - plural version is often preferred for newer SDKs
                const binArrays = await pool.getBinArrayForSwap(isXSOL);
                const quote = pool.swapQuote(amountInBN, isXSOL, new BN(0), binArrays);

                setOutAmount(
                    (Number(quote.outAmount.toString()) / Math.pow(10, outDecimals)).toFixed(6)
                );
            } catch (e) {
                console.error("Quote error", e);
                setOutAmount("0");
            }
        };

        updateQuote();
    }, [inAmount, pool]);

    /* ---------------- EXECUTE SWAP ---------------- */
    const handleSwap = async () => {
        if (!publicKey || !signTransaction || !pool || !inAmount) {
            console.log("⚠️ Swap check failed", { hasPk: !!publicKey, hasSign: !!signTransaction, hasPool: !!pool, hasAmt: !!inAmount });
            return;
        }

        setSwapping(true);
        try {
            const WSOL_ADDR = "So11111111111111111111111111111111111111112";
            const isXSOL = pool.tokenX.publicKey.toBase58() === WSOL_ADDR;

            const inToken = isXSOL ? pool.tokenX.publicKey : pool.tokenY.publicKey;
            const outToken = isXSOL ? pool.tokenY.publicKey : pool.tokenX.publicKey;
            const inTokenInfo = isXSOL ? pool.tokenX : pool.tokenY;

            const decimals = inTokenInfo.decimals || 9;
            const amountFloat = parseFloat(inAmount);
            const rawInAmountStr = BigInt(Math.floor(amountFloat * Math.pow(10, decimals))).toString();
            const rawInAmountBN = new BN(rawInAmountStr);

            // 1. Get Active Bin Arrays
            const binArrays = await pool.getBinArrayForSwap(isXSOL);

            // 2. Hydrate Swap Quote (1% slippage / 100 bps)
            const quote = pool.swapQuote(rawInAmountBN, isXSOL, new BN(100), binArrays);

            console.log("🚀 Executing Swap Transaction", {
                in: inToken.toBase58(),
                out: outToken.toBase58(),
                amount: rawInAmountStr
            });

            // 3. Build Transaction according to DLMM GitHub reference
            const swapTx = await pool.swap({
                inToken,
                outToken,
                inAmount: rawInAmountBN,
                minOutAmount: quote.minOutAmount,
                lbPair: pool.pubkey,
                user: publicKey,
                binArraysPubkey: quote.binArraysPubkey,
            });

            const { blockhash } = await connection.getLatestBlockhash("finalized");
            swapTx.recentBlockhash = blockhash;
            swapTx.feePayer = publicKey;

            const signedTx = await signTransaction(swapTx);
            const txid = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(txid, "confirmed");

            toast.success(`Successfully swapped for ${tokenSymbol}! Access granted.`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (e: any) {
            console.error("Swap execution failed", e);
            toast.error(e.message || "Swap failed");
        } finally {
            setSwapping(false);
        }
    };

    /* ---------------- UI ---------------- */
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
                    >
                        <h2 className="text-3xl font-black uppercase mb-2">
                            Alpha Exchange
                        </h2>

                        <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase mb-8">
                            Swap SOL for {tokenSymbol} to access {communityName}
                        </p>

                        {loadingPool ? (
                            <div className="py-20 text-center">Loading pool…</div>
                        ) : (
                            <div className="space-y-4">
                                <input
                                    type="number"
                                    value={inAmount}
                                    onChange={(e) => setInAmount(e.target.value)}
                                    placeholder="SOL amount"
                                    className="w-full bg-white/5 p-4 rounded-xl text-xl font-bold"
                                />

                                <div className="text-center text-gray-400 text-lg">
                                    ≈ {outAmount} {tokenSymbol}
                                </div>

                                <button
                                    onClick={handleSwap}
                                    disabled={swapping || Number(inAmount) <= 0}
                                    className="w-full py-5 rounded-2xl bg-orange-500 text-black font-black uppercase"
                                >
                                    {swapping ? "Swapping…" : "Execute Swap"}
                                </button>

                                <button
                                    onClick={onClose}
                                    className="w-full py-3 text-xs tracking-widest text-gray-500"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
