"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileX, FileCheck, ShieldAlert } from "lucide-react";

const UPLOADS = [
  {
    name: "P60_2023.pdf",
    verdict: "Rejected",
    reason: "Wrong tax year — expected 2025/26",
    color: "#ef4444",
    Icon: FileX,
    delay: 0.3,
  },
  {
    name: "SA302_draft.pdf",
    verdict: "Rejected",
    reason: "Unrecognised format",
    color: "#ef4444",
    Icon: FileX,
    delay: 0.7,
  },
  {
    name: "P60_2025.pdf",
    verdict: "Accepted",
    reason: "Tax year verified",
    color: "#10b981",
    Icon: FileCheck,
    delay: 1.1,
  },
];

export const AutoRejectIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setRevealedCount(0);
      UPLOADS.forEach((u, i) => {
        const t = setTimeout(() => setRevealedCount(i + 1), (u.delay * 1000));
        timerRef.current.push(t);
      });
    } else {
      setRevealedCount(0);
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex items-center justify-center px-3 py-2">
      <div className="w-full max-w-[200px]">

        {/* Header */}
        <motion.div
          className="flex items-center gap-1.5 mb-3"
          animate={{ opacity: isHovered ? 1 : 0.35 }}
          transition={{ duration: 0.3 }}
        >
          <ShieldAlert size={11} className="text-red-400" strokeWidth={2} />
          <span className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
            Client upload scan
          </span>
        </motion.div>

        {/* Upload results */}
        <div className="flex flex-col gap-2">
          {UPLOADS.map((u, i) => {
            const isRevealed = i < revealedCount;
            const Icon = u.Icon;
            return (
              <motion.div
                key={i}
                className="rounded-lg border border-white/[0.06] bg-card/60 px-2.5 py-2 shadow-sm"
                animate={{
                  opacity: isHovered ? 1 : 0.5,
                  x: isHovered ? 0 : -4,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: i * 0.08,
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon
                      size={10}
                      style={{ color: isRevealed ? u.color : "rgba(148,163,184,0.4)" }}
                      strokeWidth={2}
                      className="flex-shrink-0"
                    />
                    <span className="text-[8px] font-bold text-foreground/65 truncate">
                      {u.name}
                    </span>
                  </div>

                  <AnimatePresence>
                    {isRevealed && (
                      <motion.span
                        className="rounded-full px-2 py-[2px] text-[7px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: u.color }}
                        initial={{ opacity: 0, scale: 0.5, x: 8 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 18,
                        }}
                      >
                        {u.verdict}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <motion.p
                  className="text-[7px] text-muted-foreground/40 pl-[18px]"
                  animate={{ opacity: isRevealed ? 0.7 : 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  {u.reason}
                </motion.p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
