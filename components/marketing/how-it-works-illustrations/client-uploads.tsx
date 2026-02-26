"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle2 } from "lucide-react";

export const ClientUploadsIllustration: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  // phase 0: idle | 1: doc rising | 2: doc landed in zone | 3: progress bar full
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 1050);
    const t3 = setTimeout(() => setPhase(3), 1750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive]);

  return (
    <div className="w-full h-full flex flex-col justify-between gap-2.5">
      {/* Upload zone */}
      <motion.div
        animate={{
          borderColor:
            phase >= 2 ? "rgba(34,197,94,0.4)" : "rgba(var(--border),0.4)",
          backgroundColor: phase >= 2 ? "rgba(34,197,94,0.05)" : "transparent",
        }}
        transition={{ duration: 0.4 }}
        className="flex-1 rounded-xl border-2 border-dashed border-border/40 flex items-center justify-center"
      >
        {phase >= 2 ? (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="flex items-center gap-2"
          >
            <CheckCircle2 size={14} className="text-green-500" />
            <span className="text-[11px] font-medium text-green-500">accounts.pdf</span>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-40">
            <Upload size={14} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Drop files here</span>
          </div>
        )}
      </motion.div>

      {/* Animated document pill — always rendered to avoid layout shift */}
      <motion.div
        animate={
          phase >= 1
            ? { y: -18, opacity: 0, pointerEvents: "none" }
            : { y: 0, opacity: phase === 0 && isActive ? 1 : phase === 0 ? 0 : 1 }
        }
        initial={{ opacity: 0, y: 0 }}
        transition={{ duration: 0.7, ease: [0.2, 0, 0.6, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="self-center flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/40"
      >
        <FileText size={12} className="text-violet-500" />
        <span className="text-[11px] font-medium text-foreground">accounts.pdf</span>
      </motion.div>

      {/* Progress bar */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: phase >= 2 ? "100%" : "0%" }}
            transition={{ duration: 0.65, ease: "easeOut", delay: phase >= 2 ? 0.05 : 0 }}
            className="h-full rounded-full bg-violet-500"
          />
        </div>
        <motion.span
          animate={{ opacity: phase >= 3 ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-[11px] font-semibold text-green-500 shrink-0"
        >
          ✓
        </motion.span>
      </div>
    </div>
  );
};
