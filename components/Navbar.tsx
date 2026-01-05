import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/live", label: "Live Hub" },
    { href: "/communities", label: "Communities" },
    { href: "/feed", label: "Feed" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full flex justify-between items-center px-6 md:px-12 py-5 border-b border-white/10 bg-black/50 backdrop-blur-xl shadow-2xl z-[100] sticky top-0"
    >
      <Link
        href="/"
        className="font-black text-2xl tracking-tighter text-white hover:opacity-80 transition-opacity"
      >
        SOLANA<span className="text-orange-500">COMMUNITY</span>
      </Link>

      {/* Desktop Links */}
      <div className="hidden md:flex gap-10 items-center">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-gray-400 font-semibold hover:text-white transition-all duration-300 text-sm tracking-widest uppercase"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Mobile Toggle */}
      <button
        className="md:hidden text-white p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-6 h-5 relative flex flex-col justify-between">
          <motion.span
            animate={isOpen ? { rotate: 45, y: 9 } : { rotate: 0, y: 0 }}
            className="w-full h-0.5 bg-white rounded-full origin-left"
          />
          <motion.span
            animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
            className="w-full h-0.5 bg-white rounded-full"
          />
          <motion.span
            animate={isOpen ? { rotate: -45, y: -9 } : { rotate: 0, y: 0 }}
            className="w-full h-0.5 bg-white rounded-full origin-left"
          />
        </div>
      </button>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 w-full bg-black/95 backdrop-blur-3xl border-b border-white/10 md:hidden overflow-hidden flex flex-col p-6 gap-6"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-gray-300 font-bold text-lg hover:text-orange-500 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
