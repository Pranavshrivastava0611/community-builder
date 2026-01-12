"use client";

import GlassPanel from "@/components/GlassPanel";
import GlowButton from "@/components/GlowButton";
import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

// Types matching database schema + UI needs
interface Community {
  id: string;
  name: string;
  description: string;
  image_url: string;
  members?: number; // Optional, placeholder for now
  created_at?: string;
}

export default function CommunityPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchCommunities() {
      try {
        const res = await fetch("/api/communities");
        const data = await res.json();
        if (data.communities) {
          setCommunities(data.communities);
        }
      } catch (error) {
        console.error("Failed to fetch communities", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCommunities();
  }, []);

  const filteredCommunities = communities.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden selection:bg-orange-500/30">
      {/* Background Visuals */}
      <div
        className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none"
        style={{
          maskImage: "linear-gradient(to bottom, black 20%, transparent 90%)",
        }}
      ></div>
      <div className="absolute top-0 right-1/4 w-[800px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none opacity-40"></div>

      <Navbar />
      <main className="relative z-10 flex flex-col md:flex-row gap-10 px-4 md:px-10 pt-12 pb-16 max-w-7xl mx-auto transition-all duration-500">
        {/* Sidebar Filters */}
        <GlassPanel className="hidden md:flex flex-col gap-5 p-6 min-w-[260px] h-fit md:sticky top-28 self-start">
          <h3 className="text-2xl font-bold font-heading text-white mb-4">
            Filters
          </h3>
          <GlowButton className="w-full text-lg py-3">Most Active</GlowButton>
          <GlowButton className="w-full text-lg py-3 !bg-none !bg-white/5 border border-white/10 !text-gray-300 hover:!text-white hover:!border-orange-500/50 hover:!bg-white/10">
            Newest
          </GlowButton>
          <GlowButton className="w-full text-lg py-3 !bg-none !bg-white/5 border border-white/10 !text-gray-300 hover:!text-white hover:!border-orange-500/50 hover:!bg-white/10">
            Top Earning
          </GlowButton>
        </GlassPanel>

        {/* Main Section */}
        <div className="flex-1">
          {/* Revenue Upsell Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-12 relative group rounded-[2.5rem] overflow-hidden border border-orange-500/20 bg-gradient-to-r from-orange-600/10 via-black to-black p-8 md:p-12 shadow-2xl"
          >
            <div className="absolute top-0 right-0 p-6 md:p-10 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-orange-500 animate-pulse">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>

            <div className="relative z-10 max-w-2xl">
              <span className="inline-block px-4 py-1.5 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-widest mb-6">
                Creator Economy 2.0
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tighter mb-6">
                Be the <span className="text-orange-500">Founder.</span> <br />
                Build Value, <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Earn SOL.</span>
              </h2>
              <p className="text-gray-400 text-sm md:text-lg mb-8 leading-relaxed font-medium">
                Every community member earns you revenue. Create your own utility token, launch a liquidity pool on Meteora, and capture a 1.5% fee on every single transmission and trade.
              </p>

              <Link href="/communities/create">
                <GlowButton className="px-10 py-5 text-sm">
                  Launch Your Empire
                </GlowButton>
              </Link>
            </div>
          </motion.div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-6">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl sm:text-5xl font-black font-heading text-white text-center sm:text-left tracking-tighter"
            >
              Uplink <span className="text-orange-500">Directory</span>
            </motion.h2>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="flex-1 sm:w-80 relative group">
                <input
                  type="text"
                  placeholder="Scan frequencies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 pl-12 shadow-sm group-hover:bg-white/10 font-mono text-sm"
                />
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Community Cards */}
          {loading ? (
            <div className="text-center py-20 text-gray-400 animate-pulse">
              Loading communities...
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              No matching frequencies detected.
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.15 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
            >
              {filteredCommunities.map((c) => (
                <Link href={`/communities/${c.name}`} key={c.id}>
                  <motion.div
                    whileHover={{
                      scale: 1.02,
                      boxShadow: "0 10px 30px rgba(249, 115, 22, 0.15)",
                    }}
                    className="relative block group transition-all duration-500 h-full"
                  >
                    <GlassPanel className="h-full overflow-hidden border border-white/10 group-hover:border-orange-500/50 rounded-2xl bg-white/5 backdrop-blur-sm transition duration-500 shadow-lg hover:shadow-orange-500/10 flex flex-col">
                      <div className="relative h-48 overflow-hidden rounded-t-2xl flex-shrink-0">
                        <div className="absolute inset-0 bg-gray-800 animate-pulse"></div>
                        <img
                          src={
                            c.image_url && c.image_url.startsWith("http")
                              ? c.image_url
                              : "/images/placeholder-community.jpg" // Fallback
                          }
                          alt={c.name}
                          className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out relative z-10"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        {/* Fallback gradient if image fails or loading */}
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black hover:from-gray-700 transition-colors -z-0"></div>

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-20"></div>
                        <div className="absolute bottom-0 left-0 p-5 text-white z-30">
                          <h3 className="text-2xl font-bold font-heading mb-1 tracking-tight truncate pr-4">
                            {c.name}
                          </h3>
                          <p className="text-xs font-mono text-orange-400 bg-black/50 px-2 py-1 rounded inline-block">
                            {(c.members || 0).toLocaleString()} members
                          </p>
                        </div>
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <p className="text-gray-400 mb-6 text-sm leading-relaxed flex-1 line-clamp-3">
                          {c.description}
                        </p>
                        <GlowButton className="w-full text-sm py-2">
                          View Community
                        </GlowButton>
                      </div>
                    </GlassPanel>
                  </motion.div>
                </Link>
              ))}
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-8 py-8 text-center border-t border-white/10 bg-black/40 backdrop-blur-md mt-10 rounded-t-2xl">
        <div className="flex justify-center gap-6 mb-3">
          {["Twitter", "Docs", "Discord"].map((link) => (
            <a
              key={link}
              href="#"
              className="hover:text-orange-500 transition text-gray-500 text-sm font-medium"
            >
              {link}
            </a>
          ))}
        </div>
        <p className="text-gray-600 text-xs">
          &copy; {new Date().getFullYear()} Solana Community — Crafted with
          precision.
        </p>
      </footer>
    </div>
  );
}
