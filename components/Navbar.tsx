import { motion } from "framer-motion";
import Link from "next/link";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full flex justify-between items-center px-8 py-6 border-b border-white/5 bg-black/30 backdrop-blur-md shadow-sm z-50 sticky top-0"
    >
      <Link
        href="/"
        className="font-extrabold text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400"
      >
        SOLANA<span className="text-orange-500">COMMUNITY</span>
      </Link>

      <div className="flex gap-8 items-center">
        {[
          { href: "/", label: "Home" },
          { href: "/communities", label: "Communities" },
          { href: "/feed", label: "Feed" },
          { href: "/profile", label: "Profile" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-gray-300 font-medium hover:text-orange-500 transition-colors duration-300 text-sm tracking-wide"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </motion.nav>
  );
}
