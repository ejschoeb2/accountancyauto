"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine } from "lucide-react";

const DOCS = [
  { label: "P60 — 2025/26",  verdict: "Verified",     color: "#10b981", icon: "✓", confidence: 98 },
  { label: "SA302 — 2024/25", verdict: "Likely match", color: "#f59e0b", icon: "~", confidence: 74 },
  { label: "P45 — Wrong year", verdict: "Rejected",    color: "#ef4444", icon: "✕", confidence: 12 },
];

export const DocumentIntelligenceIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [scannedCount, setScannedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setScannedCount(0);
      DOCS.forEach((_, i) => {
        const t = setTimeout(() => setScannedCount(i + 1), 500 + i * 500);
        timerRef.current.push(t);
      });
    } else {
      setScannedCount(0);
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="relative w-full h-full flex items-center justify-center px-3 py-2">
      <div className="w-full max-w-[200px]">

        {/* Scanner header */}
        <motion.div
          className="flex items-center gap-1.5 mb-3"
          animate={{ opacity: isHovered ? 1 : 0.35 }}
          transition={{ duration: 0.3 }}
        >
          <ScanLine size={11} className="text-sky-400" strokeWidth={2} />
          <span className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
            Analysing uploads
          </span>
        </motion.div>

        {/* Document rows */}
        <div className="flex flex-col gap-2">
          {DOCS.map((doc, i) => {
            const isScanned = i < scannedCount;
            return (
              <motion.div
                key={i}
                className="rounded-lg border border-white/[0.06] bg-card/60 px-2.5 py-2 shadow-sm"
                animate={{
                  x: isHovered ? 0 : -4,
                  opacity: isHovered ? 1 : 0.6,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: i * 0.08,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  {/* Document label */}
                  <span className="text-[8px] font-bold text-foreground/65">
                    {doc.label}
                  </span>

                  {/* Verdict badge */}
                  <AnimatePresence>
                    {isScanned && (
                      <motion.span
                        className="rounded-full px-2 py-[2px] text-[7px] font-bold text-white"
                        style={{ backgroundColor: doc.color }}
                        initial={{ opacity: 0, scale: 0.6, x: 8 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 18,
                        }}
                      >
                        {doc.icon} {doc.verdict}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Scan progress bar */}
                <div className="h-[2px] rounded-full bg-muted-foreground/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: isScanned ? doc.color : "#64748b" }}
                    initial={{ width: "0%" }}
                    animate={{
                      width: isScanned ? "100%" : isHovered && i <= scannedCount ? "60%" : "0%",
                    }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
