"use client";

import { motion } from "framer-motion";
import { RotateCw } from "lucide-react";

const DEADLINES = [
  { filing: "CT600",           from: "2024/25", to: "2025/26", delay: 0.15 },
  { filing: "VAT Return",      from: "Q4 2025", to: "Q1 2026", delay: 0.25 },
  { filing: "Self Assessment", from: "2024/25", to: "2025/26", delay: 0.35 },
];

export const YearRolloverIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-3 py-2">
    <div className="w-full max-w-[170px]">

      {/* Roll forward button */}
      <motion.div
        className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-[5px] mb-3 w-fit"
        animate={{
          borderColor: isHovered ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.15)",
          scale: isHovered ? 1.02 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <motion.div
          animate={{ rotate: isHovered ? 360 : 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeInOut" }}
        >
          <RotateCw size={9} className="text-amber-500" strokeWidth={2.5} />
        </motion.div>
        <span className="text-[8px] font-bold text-amber-500">Roll Forward</span>
      </motion.div>

      {/* Deadline rows */}
      <div className="space-y-[5px]">
        {DEADLINES.map((d, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2 px-1"
            animate={{ opacity: isHovered ? 1 : 0.45 }}
            transition={{ duration: 0.25, delay: d.delay }}
          >
            {/* Filing type */}
            <span className="text-[8px] font-bold text-muted-foreground/60 w-[52px] flex-shrink-0 truncate">
              {d.filing}
            </span>

            {/* Year transition */}
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <motion.span
                className="text-[8px] text-muted-foreground/40 tabular-nums"
                animate={{
                  opacity: isHovered ? 0.3 : 0.6,
                  x: isHovered ? -2 : 0,
                }}
                transition={{ duration: 0.2, delay: d.delay }}
              >
                {d.from}
              </motion.span>
              <motion.span
                className="text-[8px] text-amber-500/60"
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.15, delay: d.delay }}
              >
                →
              </motion.span>
              <motion.span
                className="text-[8px] font-bold text-amber-500 tabular-nums"
                animate={{
                  opacity: isHovered ? 1 : 0,
                  x: isHovered ? 0 : 5,
                }}
                transition={{
                  type: "spring",
                  stiffness: 280,
                  damping: 18,
                  delay: d.delay + 0.1,
                }}
              >
                {d.to}
              </motion.span>
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  </div>
);
