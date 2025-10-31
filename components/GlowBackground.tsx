import { motion } from "framer-motion";

export default function GlowBackground() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 -z-10"
    >
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 pointer-events-none">
        {/* Neon gradient blobs */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: 1.1, opacity: 1 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
          className="absolute top-0 left-0 w-2/3 h-2/3 blur-3xl"
          style={{
            background: "radial-gradient(circle at 20% 40%, #00FFFF88 0%, transparent 70%)",
          }}
        />
        <motion.div
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.2, opacity: 1 }}
          transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
          className="absolute bottom-0 right-0 w-1/2 h-1/2 blur-3xl"
          style={{
            background: "radial-gradient(circle at 80% 80%, #9D00FF88 0%, transparent 70%)",
          }}
        />
        <motion.div
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.1, opacity: 1 }}
          transition={{ duration: 2.5, repeat: Infinity, repeatType: "reverse" }}
          className="absolute top-1/2 left-1/2 w-1/3 h-1/3 blur-2xl"
          style={{
            background: "radial-gradient(circle at 50% 50%, #FF00FF88 0%, transparent 70%)",
          }}
        />
      </div>
    </motion.div>
  );
}