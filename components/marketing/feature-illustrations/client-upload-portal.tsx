"use client";

import { motion } from "framer-motion";
import { Upload, FileCheck, ShieldCheck } from "lucide-react";

const ITEMS = [
  { label: "P60",             delay: 0.08 },
  { label: "Bank statements", delay: 0.18 },
  { label: "Invoices",        delay: 0.28 },
];

export const ClientUploadPortalIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-3 py-2">
    <div className="w-full max-w-[180px]">

      {/* Upload zone */}
      <motion.div
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-violet-400/40 bg-violet-500/[0.04] px-3 py-2 mb-2.5"
        animate={{
          borderColor: isHovered ? "rgba(139,92,246,0.5)" : "rgba(139,92,246,0.25)",
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={{ y: isHovered ? -2 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
        >
          <Upload size={13} className="text-violet-400" strokeWidth={2} />
        </motion.div>
        <span className="text-[8px] text-muted-foreground/55 font-medium">
          Drop files here
        </span>
      </motion.div>

      {/* Checklist items */}
      <div className="space-y-[5px]">
        {ITEMS.map((item, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2 px-1"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: isHovered ? 1 : 0.45, x: isHovered ? 0 : -5 }}
            transition={{ duration: 0.2, delay: item.delay }}
          >
            <motion.div
              animate={{ scale: isHovered ? 1 : 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: item.delay + 0.1 }}
            >
              <FileCheck size={10} className="text-violet-400 flex-shrink-0" strokeWidth={2} />
            </motion.div>
            <span className="text-[8px] text-muted-foreground/55 leading-none">{item.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Secure badge */}
      <motion.div
        className="flex items-center gap-1 mt-2.5 px-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 0.6 : 0 }}
        transition={{ duration: 0.2, delay: 0.4 }}
      >
        <ShieldCheck size={8} className="text-emerald-500" strokeWidth={2} />
        <span className="text-[7px] text-emerald-500/80 font-medium">No login required</span>
      </motion.div>

    </div>
  </div>
);
