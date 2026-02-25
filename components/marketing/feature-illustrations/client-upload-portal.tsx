"use client";

import { motion } from "framer-motion";
import { FileText, FolderOpen, Check } from "lucide-react";

export const ClientUploadPortalIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-between py-3 px-6">

    {/* Folder + checkmark badge at top */}
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={{ scale: isHovered ? 1.12 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.34 }}
      >
        <FolderOpen size={24} className="text-violet-500" strokeWidth={1.5} />
      </motion.div>

      <motion.div
        className="absolute -right-1 -top-1 w-[14px] h-[14px] rounded-full bg-violet-500 flex items-center justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: isHovered ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 460, damping: 13, delay: 0.5 }}
      >
        <Check size={8} strokeWidth={3.5} className="text-white" />
      </motion.div>
    </div>

    {/* Dashed connector */}
    <svg width="2" height="28" viewBox="0 0 2 28" className="flex-shrink-0">
      <line
        x1="1" y1="0" x2="1" y2="28"
        stroke="rgb(139 92 246 / 0.3)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
    </svg>

    {/* Flying file */}
    <motion.div
      className="flex items-center justify-center"
      animate={{
        y:       isHovered ? -44 : 0,
        opacity: isHovered ? 0   : 1,
      }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.05 }}
    >
      <FileText size={20} className="text-violet-400" strokeWidth={1.5} />
    </motion.div>

    {/* Browser bar at bottom */}
    <div className="w-full rounded-lg border border-border/50 bg-foreground/[0.03] px-2 pt-[5px] pb-[6px]">
      <div className="flex gap-[4px] mb-[4px]">
        <div className="w-[5px] h-[5px] rounded-full bg-red-400/50"   />
        <div className="w-[5px] h-[5px] rounded-full bg-amber-400/50" />
        <div className="w-[5px] h-[5px] rounded-full bg-green-400/50" />
      </div>
      <div className="h-[3px] rounded-full bg-foreground/[0.06] w-2/3" />
    </div>
  </div>
);
