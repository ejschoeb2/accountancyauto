"use client";

import { motion } from "framer-motion";

const DOCS = [
  { label: "P60",   verdict: "Verified",    color: "#10b981", icon: "✓" },
  { label: "SA302", verdict: "Likely match", color: "#f59e0b", icon: "~" },
  { label: "P45",   verdict: "Review",      color: "#ef4444", icon: "!" },
];

export const DocumentIntelligenceIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    <div className="flex flex-col gap-2">
      {DOCS.map((doc, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-card/80 px-3 py-2 shadow-sm"
          animate={{
            x: isHovered ? 0 : -4,
            opacity: isHovered ? 1 : 0.7,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: i * 0.08,
          }}
        >
          {/* Document icon */}
          <div
            className="w-7 h-8 rounded border border-white/15 flex items-center justify-center text-[8px] font-bold text-white/90 shadow-sm"
            style={{ backgroundColor: doc.color + "CC" }}
          >
            {doc.label}
          </div>

          {/* Scanning line */}
          <motion.div
            className="flex-1 flex flex-col gap-[3px]"
            animate={{ opacity: isHovered ? 1 : 0.5 }}
          >
            <div className="h-[1.5px] bg-muted-foreground/20 rounded-full w-14" />
            <div className="h-[1.5px] bg-muted-foreground/20 rounded-full w-10" />
          </motion.div>

          {/* Verdict badge */}
          <motion.div
            className="rounded-full px-2 py-0.5 text-[7px] font-bold text-white tracking-wide"
            style={{ backgroundColor: doc.color }}
            animate={{
              scale: isHovered ? 1 : 0.85,
              opacity: isHovered ? 1 : 0.6,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 18,
              delay: i * 0.08 + 0.15,
            }}
          >
            {doc.icon} {doc.verdict}
          </motion.div>
        </motion.div>
      ))}
    </div>
  </div>
);
