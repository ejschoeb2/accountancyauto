"use client";

import { motion } from "framer-motion";

const DOCS = [
  { label: "P60",   verdict: "Verified",     color: "#10b981", icon: "✓" },
  { label: "SA302", verdict: "Likely match",  color: "#f59e0b", icon: "~" },
  { label: "P45",   verdict: "Review",        color: "#ef4444", icon: "!" },
];

export const DocumentIntelligenceIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="relative w-full h-full flex items-center justify-center px-2">
    <div className="flex flex-col gap-1.5 w-full">
      {DOCS.map((doc, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-card/80 px-2.5 py-1.5 shadow-sm"
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
          {/* Document type label */}
          <span className="text-[8px] font-bold text-muted-foreground/70 flex-shrink-0 w-7">
            {doc.label}
          </span>

          {/* Scanning line */}
          <motion.div
            className="flex-1 flex flex-col gap-[3px]"
            animate={{ opacity: isHovered ? 1 : 0.5 }}
          >
            <div className="h-[1.5px] bg-muted-foreground/20 rounded-full w-full" />
            <div className="h-[1.5px] bg-muted-foreground/20 rounded-full w-3/4" />
          </motion.div>

          {/* Verdict badge */}
          <motion.div
            className="rounded-full px-2.5 py-[3px] text-[8px] font-bold text-white tracking-wide flex-shrink-0"
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
