"use client";

import GlassPanel from "@/components/GlassPanel";
import GlowBackground from "@/components/GlowBackground";
import { motion } from "framer-motion";
import GlowButton from "@/components/GlowButton";
import Navbar from "@/components/Navbar";
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
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-[#e8edf3] text-[#1a1f2b] font-body overflow-hidden">
      <Navbar />
      <main className="relative z-10 flex flex-col md:flex-row gap-10 px-4 md:px-10 pt-28 pb-16 max-w-7xl mx-auto transition-all duration-500">
        {/* Sidebar Filters */}
        <GlassPanel className="hidden md:flex flex-col gap-5 p-6 min-w-[260px] h-fit md:sticky top-28 self-start bg-white/70 backdrop-blur-md border border-slate-200 shadow-md rounded-2xl">
          <h3 className="text-2xl font-heading font-semibold text-[#1e3a8a] mb-4">
            Filters
          </h3>
          <GlowButton className="w-full text-lg py-3 bg-[#2563eb] text-white hover:bg-[#1e40af] transition-all duration-300">
            Most Active
          </GlowButton>
          <GlowButton className="w-full text-lg py-3 bg-[#2563eb] text-white hover:bg-[#1e40af] transition-all duration-300">
            Newest
          </GlowButton>
          <GlowButton className="w-full text-lg py-3 bg-[#2563eb] text-white hover:bg-[#1e40af] transition-all duration-300">
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
              className="text-5xl sm:text-6xl font-heading font-extrabold text-[#0f172a] text-center sm:text-left"
            >
              Explore Communities
            </motion.h2>

            {/* Search Bar */}
            <div className="w-full sm:w-96 relative">
              <input
                type="text"
                placeholder="Search communities..."
                className="w-full px-6 py-3 rounded-full bg-white/80 border border-slate-300 text-[#1e293b] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb] transition-all duration-300 pl-12 shadow-sm"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
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
                    boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
                  }}
                  className="relative block group transition-all duration-500"
                >
                  <GlassPanel className="overflow-hidden border border-slate-200 group-hover:border-blue-400 rounded-2xl bg-white/90 backdrop-blur-sm transition duration-500 shadow-md hover:shadow-lg">
                    <div className="relative h-48 overflow-hidden rounded-t-2xl">
                      <img
                        src={c.banner}
                        alt={c.name}
                        className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 p-5 text-white">
                        <h3 className="text-2xl font-heading font-semibold mb-1">
                          {c.name}
                        </h3>
                        <p className="text-sm opacity-90">
                          {c.members} members
                        </p>
                      </div>
                    </div>
                    <div className="p-6">
                      <p className="text-slate-600 mb-5 text-base leading-relaxed">
                        {c.desc}
                      </p>
                      <GlowButton className="w-full text-lg py-3 bg-[#2563eb] text-white hover:bg-[#1e40af] transition-all duration-300">
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
      <footer className="relative z-10 w-full px-8 py-8 text-center border-t border-slate-200 bg-white/80 backdrop-blur-md mt-10 rounded-t-2xl shadow-inner">
        <div className="flex justify-center gap-6 mb-3">
          <a
            href="https://twitter.com/solana"
            target="_blank"
            rel="noopener"
            className="hover:text-[#2563eb] transition text-slate-600"
          >
            Twitter
          </a>
          <a
            href="https://docs.solana.com/"
            target="_blank"
            rel="noopener"
            className="hover:text-[#2563eb] transition text-slate-600"
          >
            Docs
          </a>
          <a
            href="https://discord.com/invite/solana"
            target="_blank"
            rel="noopener"
            className="hover:text-[#2563eb] transition text-slate-600"
          >
            Discord
          </a>
        </div>
        <p className="text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Solana Community — Crafted with precision.
        </p>
      </footer>
    </div>
  );
}
