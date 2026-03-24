"use client";

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

interface DeadlineRow {
  filing: string;
  formula: string;
  date: string;
  color: string;
  bg: string;
}

const ROWS: DeadlineRow[] = [
  { filing: "Corporation Tax", formula: "+9m 1d",  date: "01 Jan 2026", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  { filing: "CT600 Return",    formula: "+12m",    date: "31 Mar 2026", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  { filing: "Companies House", formula: "+9m",     date: "31 Dec 2025", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { filing: "VAT Return",      formula: "+1m 7d",  date: "07 May 2025", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  { filing: "Self Assessment",  formula: "Fixed",   date: "31 Jan 2026", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
];

export const FilingDeadlinesIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex flex-col justify-center px-5 py-4 select-none overflow-hidden">
    {/* Year-end anchor */}
    <motion.div
      className="flex items-center gap-2 mb-3"
      animate={{ opacity: isHovered ? 1 : 0.4 }}
      transition={{ duration: 0.3 }}
    >
      <Calendar size={11} className="text-violet-500" strokeWidth={2} />
      <span className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
        Year End
      </span>
      <motion.span
        className="text-[9px] font-bold text-violet-600 bg-violet-500/10 px-2 py-[2px] rounded-full"
        animate={{
          opacity: isHovered ? 1 : 0.5,
          scale: isHovered ? 1 : 0.9,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        31 Mar 2025
      </motion.span>
    </motion.div>

    {/* Deadline rows */}
    <div className="flex flex-col gap-[5px]">
      {ROWS.map((row, i) => (
        <motion.div
          key={row.filing}
          className="flex items-center gap-2"
          animate={{
            opacity: isHovered ? 1 : 0.3 + i * 0.08,
            x: isHovered ? 0 : -6,
          }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 20,
            delay: i * 0.08,
          }}
        >
          {/* Filing type */}
          <span className="text-[9px] text-muted-foreground/60 w-[88px] flex-shrink-0 truncate">
            {row.filing}
          </span>

          {/* Dotted connector */}
          <motion.div
            className="flex-1 border-b border-dashed border-border/30 min-w-[12px]"
            animate={{ opacity: isHovered ? 0.6 : 0.2 }}
            transition={{ duration: 0.2, delay: i * 0.08 + 0.1 }}
          />

          {/* Formula badge */}
          <motion.span
            className="text-[8px] font-mono font-medium text-muted-foreground/50 bg-muted/60 px-1.5 py-[2px] rounded flex-shrink-0"
            animate={{
              opacity: isHovered ? 1 : 0,
              scale: isHovered ? 1 : 0.8,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 18,
              delay: i * 0.08 + 0.15,
            }}
          >
            {row.formula}
          </motion.span>

          {/* Arrow */}
          <motion.span
            className="text-[9px] text-muted-foreground/30"
            animate={{ opacity: isHovered ? 0.6 : 0 }}
            transition={{ duration: 0.15, delay: i * 0.08 + 0.2 }}
          >
            →
          </motion.span>

          {/* Date pill */}
          <motion.span
            className="text-[8px] font-semibold px-2 py-[2px] rounded-full flex-shrink-0"
            style={{ backgroundColor: row.bg, color: row.color }}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{
              opacity: isHovered ? 1 : 0,
              scale: isHovered ? 1 : 0.75,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 18,
              delay: i * 0.08 + 0.25,
            }}
          >
            {row.date}
          </motion.span>
        </motion.div>
      ))}
    </div>
  </div>
);
