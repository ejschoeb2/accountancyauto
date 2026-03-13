"use client";

import { motion } from "framer-motion";
import { Mail, FileText, Link2 } from "lucide-react";

const OUTSTANDING = [
  { label: "Bank statements", delay: 0.18 },
  { label: "Dividend vouchers", delay: 0.3 },
];

export const DocumentAwareEmailsIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-3 py-2">
    <div className="w-full max-w-[180px]">

      {/* Email envelope header */}
      <div className="flex items-center gap-2 mb-2.5">
        <motion.div
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
        >
          <Mail size={14} className="text-indigo-400" strokeWidth={1.5} />
        </motion.div>
        <div className="flex-1">
          <div className="h-[4px] rounded-full bg-foreground/[0.08] w-20 mb-1" />
          <div className="h-[3px] rounded-full bg-foreground/[0.05] w-14" />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40 mb-2" />

      {/* Outstanding docs list */}
      <div className="space-y-[6px] mb-2.5">
        {OUTSTANDING.map((doc, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -5 }}
            transition={{ duration: 0.2, delay: doc.delay }}
          >
            <FileText size={9} className="text-amber-500 flex-shrink-0" strokeWidth={2} />
            <span className="text-[8px] text-muted-foreground/60 leading-none">
              {doc.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Upload link button */}
      <motion.div
        className="flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 px-2 py-[3px] w-fit"
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 3 }}
        transition={{ duration: 0.2, delay: 0.42 }}
      >
        <Link2 size={8} className="text-indigo-400" strokeWidth={2} />
        <span className="text-[7px] font-semibold text-indigo-400 leading-none">
          Upload here
        </span>
      </motion.div>

    </div>
  </div>
);
