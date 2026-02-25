"use client";

import { motion } from "framer-motion";

const FILES = [
  { label: "CT600", color: "#f59e0b", rotate: -16, x: -30, z: 1 },
  { label: "VAT",   color: "#3b82f6", rotate: -8,  x: -15, z: 2 },
  { label: "SA100", color: "#8b5cf6", rotate:  0,  x:   0, z: 3 },
  { label: "CH",    color: "#10b981", rotate:  8,  x:  15, z: 2 },
  { label: "PAYE",  color: "#ef4444", rotate: 16,  x:  30, z: 1 },
];

export const DocumentStorageIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    {FILES.map((file, i) => (
      <motion.div
        key={i}
        className="absolute w-12 h-[62px] rounded-lg border border-white/15 flex flex-col items-start justify-end p-1.5 shadow-md"
        style={{
          backgroundColor: file.color + "CC",
          zIndex:   file.z,
          originX: "50%",
          originY: "85%",
        }}
        animate={{
          rotate: isHovered ? file.rotate  : (i - 2) * 1.5,
          x:      isHovered ? file.x       : (i - 2) * 2.5,
          y:      isHovered ? -4           : 0,
        }}
        transition={{
          type:    "spring",
          stiffness: 260,
          damping: 20,
          delay:   Math.abs(i - 2) * 0.05,
        }}
      >
        {/* Document lines */}
        <div className="w-full space-y-[3px] mb-1.5">
          <div className="h-[1.5px] bg-white/30 rounded-full w-full" />
          <div className="h-[1.5px] bg-white/30 rounded-full w-3/4" />
          <div className="h-[1.5px] bg-white/30 rounded-full w-1/2" />
        </div>
        <span className="text-[7px] font-bold text-white/90 tracking-wide leading-none">
          {file.label}
        </span>
      </motion.div>
    ))}
  </div>
);
