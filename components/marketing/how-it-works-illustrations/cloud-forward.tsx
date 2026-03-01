"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Folder, CheckCircle2 } from "lucide-react";

const PROVIDERS = [
  { name: "Google Drive", iconColor: "text-emerald-500", textColor: "text-emerald-500" },
  { name: "OneDrive", iconColor: "text-blue-400", textColor: "text-blue-400" },
  { name: "Dropbox", iconColor: "text-sky-400", textColor: "text-sky-400" },
];

export const CloudForwardIllustration: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [phase, setPhase] = useState(0);
  // 0: idle | 1: flow line grows | 2: file arrives at folder | 3: checkmark appears

  useEffect(() => {
    if (!isActive) return;
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 1550);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive]);

  return (
    <div className="w-full h-full flex items-center justify-between gap-4 px-4">

      {/* Source: Prompt document */}
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <motion.div
          animate={{ scale: phase === 1 ? [1, 1.07, 1] : 1 }}
          transition={{ duration: 0.35 }}
          className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center"
        >
          <FileText size={18} className="text-violet-500" />
        </motion.div>
        <span className="text-[8px] font-semibold text-violet-400/60 uppercase tracking-widest">
          Prompt
        </span>
      </div>

      {/* Animated flow line */}
      <div className="flex-1 relative flex items-center">
        <div className="w-full h-px bg-border/20" />
        <motion.div
          className="absolute inset-y-0 left-0 h-px bg-violet-400"
          style={{ originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
        />
        {/* Arrow dot at end of line */}
        <motion.div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400"
          initial={{ opacity: 0, scale: 0 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
          transition={{ duration: 0.2, delay: 0.82 }}
        />
      </div>

      {/* Cloud provider targets */}
      <div className="flex flex-col gap-2 shrink-0 min-w-[108px]">
        {PROVIDERS.map((p, i) => (
          <motion.div
            key={p.name}
            animate={
              phase >= 2 && i === 0
                ? {
                    borderColor: "rgba(16,185,129,0.45)",
                    backgroundColor: "rgba(16,185,129,0.07)",
                  }
                : {}
            }
            transition={{ duration: 0.35 }}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
              i === 0 ? "border-border/40" : "border-border/20"
            }`}
          >
            <Folder
              size={11}
              className={i === 0 ? p.iconColor : "text-muted-foreground/25"}
            />
            <span
              className={`text-[9px] font-medium flex-1 ${
                i === 0 ? p.textColor : "text-muted-foreground/25"
              }`}
            >
              {p.name}
            </span>
            {phase >= 3 && i === 0 && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 14 }}
              >
                <CheckCircle2 size={9} className="text-emerald-500" />
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>

    </div>
  );
};
