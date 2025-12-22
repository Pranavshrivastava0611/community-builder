"use client";

import GlassPanel from "@/components/GlassPanel";
import GlowButton from "@/components/GlowButton";
import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import Link from "next/link";

const communities = [
  {
    name: "Solana Builders",
    members: 4200,
    banner: "/images/solana-builders.jpg",
    desc: "A hub for developers building on Solana.",
    link: "/communities/solana-builders",
  },
  {
    name: "NFT Artists",
    members: 2100,
    banner: "/images/nft-artists.jpg",
    desc: "Showcase, collaborate, and mint your art.",
    link: "/communities/nft-artists",
  },
  {
    name: "DeFi Wizards",
    members: 3200,
    banner: "/images/defi-wizards.jpg",
    desc: "Explore the future of decentralized finance.",
    link: "/communities/defi-wizards",
  },
  {
    name: "Gaming Guild",
    members: 1800,
    banner: "/images/gaming-guild.jpg",
    desc: "Connect with game devs and players.",
    link: "/communities/gaming-guild",
  },
  {
    name: "DAO Governance",
    members: 850,
    banner: "/images/dao-governance.jpg",
    desc: "Learn and participate in decentralized autonomous organizations.",
    link: "/communities/dao-governance",
  },
  {
    name: "Solana Dev Tools",
    members: 1500,
    banner: "/images/solana-dev-tools.jpg",
    desc: "Discover and contribute to essential Solana development tools.",
    link: "/communities/solana-dev-tools",
  },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden selection:bg-orange-500/30">

      {/* Background Visuals */}
      <div
        className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none"
        style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)' }}
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
          <GlowButton className="w-full text-lg py-3">
            Most Active
          </GlowButton>
          <GlowButton className="w-full text-lg py-3 !bg-none !bg-white/5 border border-white/10 !text-gray-300 hover:!text-white hover:!border-orange-500/50 hover:!bg-white/10">
            Newest
          </GlowButton>
          <GlowButton className="w-full text-lg py-3 !bg-none !bg-white/5 border border-white/10 !text-gray-300 hover:!text-white hover:!border-orange-500/50 hover:!bg-white/10">
            Top Earning
          </GlowButton>
        </GlassPanel>

        {/* Main Section */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-6">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl sm:text-6xl font-black font-heading text-white text-center sm:text-left tracking-tighter"
            >
              Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-200">Communities</span>
            </motion.h2>

            {/* Search Bar */}
            <div className="w-full sm:w-96 relative group">
              <input
                type="text"
                placeholder="Search communities..."
                className="w-full px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 pl-12 shadow-sm group-hover:bg-white/10"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-orange-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
          </div>

          {/* Community Cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
          >
            {communities.map((c, i) => (
              <Link href={c.link} key={i}>
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
                        src={c.banner}
                        alt={c.name}
                        className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out relative z-10"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Fallback gradient if image fails or loading */}
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black hover:from-gray-700 transition-colors -z-0"></div>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-20"></div>
                      <div className="absolute bottom-0 left-0 p-5 text-white z-30">
                        <h3 className="text-2xl font-bold font-heading mb-1 tracking-tight">
                          {c.name}
                        </h3>
                        <p className="text-xs font-mono text-orange-400 bg-black/50 px-2 py-1 rounded inline-block">
                          {c.members.toLocaleString()} members
                        </p>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <p className="text-gray-400 mb-6 text-sm leading-relaxed flex-1">
                        {c.desc}
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
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-8 py-8 text-center border-t border-white/10 bg-black/40 backdrop-blur-md mt-10 rounded-t-2xl">
        <div className="flex justify-center gap-6 mb-3">
          {['Twitter', 'Docs', 'Discord'].map(link => (
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
          &copy; {new Date().getFullYear()} Solana Community — Crafted with precision.
        </p>
      </footer>
    </div>
  );
}
