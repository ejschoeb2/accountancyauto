"use client";

import { motion } from "framer-motion";

const DAYS = Array.from({ length: 20 }, (_, i) => i + 1);

const MARKS = [
  { day: 5,  bg: "rgba(239,68,68,0.14)",   dot: "#ef4444", delay: 0,    ring: true  },
  { day: 12, bg: "rgba(245,158,11,0.14)",  dot: "#f59e0b", delay: 0.14, ring: false },
  { day: 18, bg: "rgba(59,130,246,0.14)",  dot: "#3b82f6", delay: 0.28, ring: false },
];

export const DeadlineTrackingIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-3 py-2 select-none">
    <div className="w-full">
      {/* Day headers */}
      <div className="grid grid-cols-5 gap-[3px] mb-1">
        {["M", "T", "W", "T", "F"].map((d, i) => (
          <div key={i} className="text-center text-[7px] font-semibold text-muted-foreground/35 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-5 gap-[3px]">
        {DAYS.map(day => {
          const mark = MARKS.find(m => m.day === day);
          return (
            <div key={day} className="relative flex flex-col items-center justify-center h-[22px] rounded">

              {/* Highlight background */}
              {mark && (
                <motion.div
                  className="absolute inset-0 rounded"
                  style={{ backgroundColor: mark.bg }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.22, delay: mark.delay }}
                />
              )}

              {/* Day number */}
              <span className="relative text-[9px] leading-none text-muted-foreground/55 mb-[2px]">
                {day}
              </span>

              {/* Status dot */}
              {mark && (
                <motion.div
                  className="rounded-full flex-shrink-0"
                  style={{ backgroundColor: mark.dot, width: 5, height: 5 }}
                  initial={{ scale: 0 }}
                  animate={{ scale: isHovered ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 14, delay: mark.delay + 0.08 }}
                />
              )}

              {/* Pulsing ring on overdue date */}
              {mark?.ring && (
                <motion.div
                  className="absolute inset-0 rounded"
                  style={{ borderWidth: 1, borderStyle: "solid", borderColor: mark.dot }}
                  animate={isHovered
                    ? { opacity: [0, 0.65, 0], scale: [0.85, 1.25, 1.55] }
                    : { opacity: 0, scale: 0.85 }
                  }
                  transition={isHovered
                    ? { duration: 1.7, delay: 0.42, repeat: Infinity, ease: "easeOut" }
                    : { duration: 0.15 }
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
