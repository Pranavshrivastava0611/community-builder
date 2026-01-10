"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect } from "react";
// @ts-ignore
import jwt from "jsonwebtoken";

/**
 * SessionManager ensures that the JWT token stored in localStorage 
 * always matches the currently connected Solana wallet.
 * 
 * If a mismatch is detected (e.g. user switched wallets or Phantom redirected 
 * with a new state), it clears the stale token to prevent 'invalid token' 
 * and unauthorized API errors.
 */
export default function SessionManager() {
    const { publicKey, connected } = useWallet();

    useEffect(() => {
        const checkSessionSlice = () => {
            const storedToken = localStorage.getItem("authToken");
            if (!storedToken) return;

            try {
                const decoded: any = jwt.decode(storedToken);
                if (!decoded) {
                    localStorage.removeItem("authToken");
                    return;
                }

                // If wallet is connected, but doesn't match the token
                if (publicKey && decoded.public_key !== publicKey.toBase58()) {
                    console.warn("[SessionSync] Wallet mismatch detected. Clearing stale session.");
                    localStorage.removeItem("authToken");
                    window.location.reload(); // Hard reload to clear all state
                }

                // If wallet is disconnected, we might want to keep the token 
                // for public views but usually better to clear if we want 
                // strictly authenticated sessions
                if (!connected && !publicKey) {
                    // Optional: could clear here too if desired
                }
            } catch (e) {
                console.error("[SessionSync] Error decoding token:", e);
                localStorage.removeItem("authToken");
            }
        };

        checkSessionSlice();
    }, [publicKey, connected]);

    return null;
}
