"use client";

import { motion } from "framer-motion";

const ROWS = [
  {
    label: "Corporation Tax",
    date: "31 Dec 2025",
    textColor: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    label: "CT600 Return",
    date: "31 Mar 2026",
    textColor: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    label: "VAT Return",
    date: "7 Feb 2026",
    textColor: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    label: "Self Assessment",
    date: "31 Jan 2026",
    textColor: "text-red-500",
    bgColor: "bg-red-500/10",
  },
];

export const DeadlinesCalculatedIllustration: React.FC<{ isActive: boolean }> = ({
  isActive,
}) => (
  <div className="w-full h-full flex flex-col justify-center divide-y divide-border/40">
    {ROWS.map((row, i) => (
      <motion.div
        key={row.label}
        initial={{ opacity: 0, x: 14 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: 14 }}
        transition={{ duration: 0.3, delay: 0.1 + i * 0.14, ease: "easeOut" }}
        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
      >
        <span className="text-[11px] text-muted-foreground">{row.label}</span>
        <motion.span
          initial={{ opacity: 0, scale: 0.75 }}
          animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.75 }}
          transition={{ duration: 0.25, delay: 0.22 + i * 0.14, ease: "backOut" }}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${row.textColor} ${row.bgColor}`}
        >
          {row.date}
        </motion.span>
      </motion.div>
    ))}
  </div>
);
