import { motion } from "framer-motion";
import Link from "next/link";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full flex justify-between items-center px-8 py-6 border-b border-blue-100/20 bg-white/30 backdrop-blur-md shadow-sm"
    >
      <Link
        href="/"
        className="font-extrabold text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400"
      >
        Solana Blue
      </Link>

      <div className="flex gap-8 items-center">
        {[
          { href: "/", label: "Home" },
          { href: "/community", label: "Communities" },
          { href: "/stream", label: "Stream" },
          { href: "/profile", label: "Profile" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-slate-800 font-medium hover:text-blue-600 transition-colors duration-300"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </motion.nav>
  );
}
