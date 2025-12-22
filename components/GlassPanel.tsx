import { motion } from "framer-motion";
import React from "react";

export default function GlassPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl hover:shadow-2xl hover:border-orange-500/20 transition-all duration-500 ${className}`}
      style={{
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.5)",
      }}
    >
      {children}
    </motion.div>
  );
}
