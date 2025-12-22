import { HTMLMotionProps, motion } from "framer-motion";
import React from "react";

interface GlowButtonProps extends HTMLMotionProps<"button"> {
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
        boxShadow: "0 0 20px rgba(249, 115, 22, 0.4)", // soft orange shadow
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`px-6 py-3 font-semibold rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 text-black shadow-lg hover:shadow-orange-500/20 focus:outline-none focus:ring-2 focus:ring-orange-500/60 transition-all duration-300 ${className}`}
      style={{
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
