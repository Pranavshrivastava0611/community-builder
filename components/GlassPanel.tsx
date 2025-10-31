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
      className={`bg-white/40 backdrop-blur-md border border-blue-200/40 rounded-2xl shadow-md hover:shadow-lg transition-all duration-500 ${className}`}
      style={{
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.05)",
      }}
    >
      {children}
    </motion.div>
  );
}
