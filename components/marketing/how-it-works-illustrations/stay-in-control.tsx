"use client";

import { motion } from "framer-motion";

const LOG_ROWS = [
  { dot: "bg-violet-500", text: "Document received", time: "12:04" },
  { dot: "bg-blue-500", text: "Reminder sent to client", time: "12:05" },
  { dot: "bg-amber-500", text: "Reply captured", time: "14:32" },
  { dot: "bg-green-500", text: "File downloaded", time: "15:01" },
];

export const StayInControlIllustration: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <div className="w-full h-full flex flex-col justify-center gap-2.5">
    {LOG_ROWS.map((row, i) => (
      <motion.div
        key={row.text}
        initial={{ opacity: 0, x: -10 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
        transition={{ duration: 0.3, delay: 0.1 + i * 0.16, ease: "easeOut" }}
        className="flex items-center gap-2.5"
      >
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.dot}`} />
        <span className="text-[11px] text-muted-foreground flex-1 leading-none">
          {row.text}
        </span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.28 + i * 0.16 }}
          className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0"
        >
          {row.time}
        </motion.span>
      </motion.div>
    ))}
  </div>
);
