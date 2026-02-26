"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";

const MARKERS = [
  { label: "60d" },
  { label: "30d" },
  { label: "14d" },
  { label: "7d" },
];

export const RemindersScheduledIllustration: React.FC<{ isActive: boolean }> = ({
  isActive,
}) => (
  <div className="w-full h-full flex flex-col justify-center select-none">
    {/* Row 1: envelope icons */}
    <div className="flex items-end justify-around pb-2">
      {MARKERS.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.3, delay: 0.45 + i * 0.16, ease: "backOut" }}
          className="text-violet-500"
        >
          <Mail size={14} strokeWidth={1.5} />
        </motion.div>
      ))}
    </div>

    {/* Row 2: horizontal line + dots */}
    <div className="relative h-4 mx-2 flex items-center">
      {/* Line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={isActive ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
        style={{ originX: 0 }}
        className="absolute inset-x-0 h-px bg-border/60"
      />
      {/* Dots — absolutely positioned over the line */}
      <div className="absolute inset-0 flex items-center justify-around">
        {MARKERS.map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={isActive ? { scale: 1 } : { scale: 0 }}
            transition={{ duration: 0.25, delay: 0.35 + i * 0.16, ease: "backOut" }}
            className="w-2 h-2 rounded-full bg-violet-500"
          />
        ))}
      </div>
    </div>

    {/* Row 3: day labels */}
    <div className="flex items-start justify-around pt-2">
      {MARKERS.map((m, i) => (
        <motion.span
          key={m.label}
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.62 + i * 0.16 }}
          className="text-[10px] text-muted-foreground tabular-nums"
        >
          {m.label}
        </motion.span>
      ))}
    </div>
  </div>
);
