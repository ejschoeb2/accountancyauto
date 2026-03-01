"use client";

import { motion } from "framer-motion";

const deadlines = [
  { label: "Corp Tax",         formula: "Year-end + 9m 1d", color: "#ef4444", width: "72%" },
  { label: "CT600",            formula: "Year-end + 12m",   color: "#f59e0b", width: "90%" },
  { label: "Companies House",  formula: "Year-end + 9m",    color: "#3b82f6", width: "70%" },
  { label: "VAT Return",       formula: "Quarter + 1m 7d",  color: "#8b5cf6", width: "38%" },
  { label: "Self Assessment",  formula: "31 January",       color: "#10b981", width: "55%" },
];

export const UnderstandingDeadlinesIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-6 select-none">
    <div className="w-full max-w-sm space-y-1.5">
      {deadlines.map((d, i) => (
        <motion.div
          key={d.label}
          className="flex items-center gap-2"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: isHovered ? 1 : 0.3 }}
          transition={{ delay: i * 0.06, duration: 0.25 }}
        >
          {/* Label */}
          <span className="text-[8px] font-semibold text-muted-foreground w-[72px] text-right shrink-0 truncate">
            {d.label}
          </span>

          {/* Bar track */}
          <div className="flex-1 h-3 rounded-full bg-muted/40 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: d.color }}
              initial={{ width: 0 }}
              animate={{ width: isHovered ? d.width : "0%" }}
              transition={{ delay: i * 0.08 + 0.1, duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Formula */}
          <motion.span
            className="text-[7px] text-muted-foreground/60 w-[68px] shrink-0 truncate"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ delay: i * 0.08 + 0.3 }}
          >
            {d.formula}
          </motion.span>
        </motion.div>
      ))}
    </div>
  </div>
);
