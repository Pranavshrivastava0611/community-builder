"use client";

import GlobalFeed from "@/components/GlobalFeed";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

export default function GlobalFeedPage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans relative overflow-x-hidden selection:bg-orange-500/30">
            <Toaster position="bottom-right" />
            <div className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none opacity-20"></div>
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-orange-900/10 to-transparent pointer-events-none"></div>

            <Navbar />

            <main className="relative z-10 pt-12 pb-20">
                <GlobalFeed />
            </main>
        </div>
    );
}
