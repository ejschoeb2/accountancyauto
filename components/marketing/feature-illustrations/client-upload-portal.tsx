"use client";

import { motion } from "framer-motion";
import { FileText, FolderOpen, Check } from "lucide-react";

export const ClientUploadPortalIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="relative w-full h-full flex items-center justify-center py-3 px-6">

    <div className="flex items-center gap-6">

      {/* File icon on the left */}
      <motion.div
        className="flex items-center justify-center"
        animate={{
          x:       isHovered ? 10 : 0,
          opacity: isHovered ? 0  : 1,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.05 }}
      >
        <FileText size={24} className="text-violet-400" strokeWidth={1.5} />
      </motion.div>

      {/* Dashed horizontal connector */}
      <svg width="40" height="2" viewBox="0 0 40 2" className="flex-shrink-0">
        <line
          x1="0" y1="1" x2="40" y2="1"
          stroke="rgb(139 92 246 / 0.3)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>

      {/* Folder + checkmark badge on the right */}
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: isHovered ? 1.12 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.34 }}
        >
          <FolderOpen size={28} className="text-violet-500" strokeWidth={1.5} />
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

    </div>

  </div>
);
