import { motion } from "framer-motion";
import React from "react";

interface GlowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export default function GlowButton({
  children,
  className = "",
  style,
  ...props
}: GlowButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={{
        scale: 1.03,
        boxShadow: "0 6px 20px rgba(37, 99, 235, 0.25)", // soft blue shadow
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`px-6 py-3 font-semibold rounded-full bg-gradient-to-r from-[#2563eb] to-[#1e40af] text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb]/60 transition-all duration-300 ${className}`}
      style={{
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
