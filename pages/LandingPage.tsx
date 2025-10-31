import GlassPanel from "@/components/GlassPanel";
import GlowBackground from "@/components/GlowBackground";
import GlowButton from "@/components/GlowButton";
import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";

// Fixes:
// - Ensure Tailwind CSS is loaded (check your globals.css or tailwind.config.js)
// - Remove drop-shadow-neon if not defined; use Tailwind's shadow or custom style
// - Use bg-clip-text and text-transparent for neon gradients
// - Add fallback for missing styles

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black relative font-sans overflow-hidden">
      <GlowBackground />
      <Navbar />
      <main className="flex flex-col items-center justify-center pt-24 pb-16 px-4">
        {/* Hero Section */}
        <GlassPanel className="max-w-2xl mx-auto p-12 mb-16 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-[#00FFFF] via-[#9D00FF] to-[#FF00FF] bg-clip-text text-transparent"
            style={{
              textShadow: "0 0 24px #00FFFF, 0 0 48px #9D00FF, 0 0 8px #FF00FF",
            }}
          >
            Build, Earn, and Connect in Web3 Communities.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-xl md:text-2xl text-white/80 mb-10"
          >
            Join the next generation of decentralized communities powered by Solana.
          </motion.p>
          <div className="flex gap-6 justify-center">
            <GlowButton>Join Community</GlowButton>
            <GlowButton className="bg-black text-[#00FFFF] border border-[#00FFFF]">Launch App</GlowButton>
          </div>
        </GlassPanel>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            {
              icon: "💎",
              title: "Tokenized Rewards",
              desc: "Earn tokens for contributions and engagement.",
              color: "from-[#00FFFF] to-[#9D00FF]",
            },
            {
              icon: "📺",
              title: "Live Streams",
              desc: "Participate in real-time events and workshops.",
              color: "from-[#9D00FF] to-[#FF00FF]",
            },
            {
              icon: "🗳️",
              title: "Governance",
              desc: "Shape the future with on-chain voting.",
              color: "from-[#FF00FF] to-[#00FFFF]",
            },
          ].map((f, i) => (
            <GlassPanel key={i} className="p-8 text-center border-2 border-transparent hover:border-[#00FFFF] transition">
              <div
                className="text-5xl mb-4"
                style={{
                  textShadow: "0 0 16px #00FFFF, 0 0 32px #9D00FF, 0 0 8px #FF00FF",
                }}
              >
                {f.icon}
              </div>
              <h3
                className={`text-2xl font-bold mb-2 bg-gradient-to-r ${f.color} bg-clip-text text-transparent`}
                style={{
                  textShadow: "0 0 8px #00FFFF88",
                }}
              >
                {f.title}
              </h3>
              <p className="text-white/80">{f.desc}</p>
            </GlassPanel>
          ))}
        </div>

        {/* Testimonials / Highlights */}
        <GlassPanel className="max-w-3xl mx-auto p-8 mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-extrabold mb-4 bg-gradient-to-r from-[#00FFFF] via-[#9D00FF] to-[#FF00FF] bg-clip-text text-transparent"
            style={{
              textShadow: "0 0 16px #00FFFF, 0 0 32px #9D00FF, 0 0 8px #FF00FF",
            }}
          >
            12,000+ Members. 1,500+ Projects. Infinite Possibilities.
          </motion.h2>
          <p className="text-white/80 mb-4">
            “Solana Neon helped me launch my first DAO and connect with builders worldwide.” <span className="text-[#00FFFF]">– @solanafan</span>
          </p>
          <p className="text-white/80">
            “The live streams and rewards keep me coming back every week!” <span className="text-[#FF00FF]">– @web3dev</span>
          </p>
        </GlassPanel>
      </main>
      <footer className="w-full px-8 py-6 text-center text-white/70 text-sm border-t border-white/10">
        <div className="flex justify-center gap-6 mb-2">
          <a href="https://twitter.com/solana" target="_blank" rel="noopener" className="hover:text-[#00FFFF] transition">Twitter</a>
          <a href="https://docs.solana.com/" target="_blank" rel="noopener" className="hover:text-[#9D00FF] transition">Docs</a>
          <a href="https://discord.com/invite/solana" target="_blank" rel="noopener" className="hover:text-[#FF00FF] transition">Discord</a>
        </div>
        &copy; {new Date().getFullYear()} Solana Neon. All rights reserved.
      </footer>
    </div>
  );
}