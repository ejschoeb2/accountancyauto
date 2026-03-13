"use client";

import { motion } from "framer-motion";

const EMAILS = [
  { from: "J. Smith",  subject: "SA reminder — Jan 2026"  },
  { from: "P. Clarke", subject: "CT600 docs outstanding"  },
  { from: "M. Webb",   subject: "VAT Q3 — records needed" },
];

export const EmailManagementIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-3 py-2">
    <div className="w-full space-y-0">

      {/* Domain badge */}
      <motion.div
        className="flex items-center gap-1.5 mb-2 px-2 py-[5px] rounded-md bg-emerald-500/10 border border-emerald-500/20 w-fit"
        animate={{ opacity: isHovered ? 1 : 0.45 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
          animate={{ boxShadow: isHovered ? "0 0 5px 1px rgba(16,185,129,0.5)" : "none" }}
          transition={{ duration: 0.3 }}
        />
        <span className="text-[8px] font-mono font-semibold text-emerald-600 leading-none">
          yourfirm.co.uk
        </span>
      </motion.div>

      {/* Email rows */}
      {EMAILS.map((email, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2 py-[5px] border-b border-border/25 last:border-0"
          animate={{ opacity: isHovered ? 1 : 0.4 + i * 0.12 }}
          transition={{ duration: 0.2, delay: i * 0.06 }}
        >
          {/* Status dot */}
          <motion.div
            className="w-[6px] h-[6px] rounded-full flex-shrink-0"
            animate={{
              backgroundColor: isHovered ? "#10b981" : "rgb(156 163 175 / 0.4)",
              boxShadow:        isHovered ? "0 0 4px rgba(16,185,129,0.5)" : "none",
            }}
            transition={{ duration: 0.22, delay: i * 0.08 + 0.14 }}
          />

          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="text-[8px] font-semibold text-foreground/65 flex-shrink-0 leading-none">
              {email.from}
            </span>
            <span className="text-[7px] text-muted-foreground/35 truncate leading-none">
              {email.subject}
            </span>
          </div>

          {/* Sent badge */}
          <motion.span
            className="text-[7px] text-emerald-500 font-semibold leading-none flex-shrink-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2, delay: i * 0.1 + 0.2 }}
          >
            Sent
          </motion.span>
        </motion.div>
      ))}
    </div>
  </div>
);
