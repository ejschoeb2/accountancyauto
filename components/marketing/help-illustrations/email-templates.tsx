"use client";

import { motion } from "framer-motion";

const lines = [
  { text: "Dear",     variable: "{{client_name}}",    varColor: "#8b5cf6" },
  { text: "Your",     variable: "{{deadline_type}}",   varColor: "#3b82f6" },
  { text: "is due on", variable: "{{deadline_date}}", varColor: "#ef4444" },
];

export const EmailTemplatesIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-6 select-none">
    <motion.div
      className="w-full max-w-xs rounded-lg border border-border/60 overflow-hidden"
      animate={{ scale: isHovered ? 1 : 0.95 }}
      transition={{ duration: 0.3 }}
    >
      {/* Email header bar */}
      <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="ml-2 text-[7px] text-muted-foreground/50">Email Template</span>
      </div>

      {/* Subject line */}
      <motion.div
        className="px-3 py-1.5 border-b border-border/30 flex items-center gap-1"
        animate={{ opacity: isHovered ? 1 : 0.4 }}
        transition={{ delay: 0.05 }}
      >
        <span className="text-[7px] text-muted-foreground/50">Subject:</span>
        <span className="text-[8px] text-foreground/70">Reminder —</span>
        <motion.span
          className="text-[8px] font-mono px-1 py-0.5 rounded"
          style={{ color: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.08)" }}
          animate={{ opacity: isHovered ? 1 : 0.3 }}
          transition={{ delay: 0.15 }}
        >
          {"{{deadline_type}}"}
        </motion.span>
      </motion.div>

      {/* Body lines */}
      <div className="px-3 py-2 space-y-1.5">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-1 flex-wrap"
            animate={{ opacity: isHovered ? 1 : 0.3 }}
            transition={{ delay: i * 0.1 + 0.1 }}
          >
            <span className="text-[9px] text-foreground/60">{line.text}</span>
            <motion.span
              className="text-[8px] font-mono px-1 py-0.5 rounded"
              style={{ color: line.varColor, backgroundColor: `${line.varColor}10` }}
              animate={{
                scale: isHovered ? [1, 1.05, 1] : 1,
              }}
              transition={{
                delay: i * 0.1 + 0.3,
                duration: 0.4,
              }}
            >
              {line.variable}
            </motion.span>
          </motion.div>
        ))}

        {/* Skeleton lines */}
        <div className="pt-1 space-y-1">
          {[85, 70, 55].map((w, i) => (
            <motion.div
              key={i}
              className="h-1 rounded-full bg-muted/50"
              style={{ width: `${w}%` }}
              animate={{ opacity: isHovered ? 0.4 : 0.15 }}
              transition={{ delay: i * 0.05 + 0.35 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  </div>
);
