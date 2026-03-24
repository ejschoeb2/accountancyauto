"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Circle } from "lucide-react";

interface StatusRow {
  status: string;
  rule: string;
  color: string;
  bg: string;
}

const STATUSES: StatusRow[] = [
  { status: "Overdue",     rule: "Past due",    color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  { status: "Critical",    rule: "≤ 7 days",    color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  { status: "Approaching", rule: "8–28 days",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { status: "On Track",    rule: "> 28 days",   color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  { status: "Complete",    rule: "Filed",        color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  { status: "Paused",      rule: "Inactive",     color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
];

/* The "Approaching" row (index 2) animates a countdown on hover */
const ANIMATE_ROW = 2;

export const TrafficLightStatusIllustration = ({
  isHovered,
}: {
  isHovered: boolean;
}) => {
  const [daysLeft, setDaysLeft] = useState(22);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isHovered) {
      setDaysLeft(22);
      const t = setTimeout(() => {
        timerRef.current = setInterval(() => {
          setDaysLeft((prev) => {
            if (prev <= 3) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 3;
            }
            return prev - 1;
          });
        }, 120);
      }, 600);
      return () => {
        clearTimeout(t);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setDaysLeft(22);
    }
  }, [isHovered]);

  /* Derive which status the animated row currently shows */
  const animatedStatus =
    daysLeft <= 7
      ? STATUSES[1] /* Critical */
      : daysLeft <= 28
        ? STATUSES[2] /* Approaching */
        : STATUSES[3]; /* On Track */

  return (
    <div className="w-full h-full flex flex-col justify-center px-5 py-4 select-none overflow-hidden">
      <div className="flex flex-col gap-[5px]">
        {STATUSES.map((row, i) => {
          const isAnimRow = i === ANIMATE_ROW;
          const displayRow = isAnimRow ? animatedStatus : row;

          return (
            <motion.div
              key={row.status}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-[6px]"
              style={{ backgroundColor: isAnimRow && isHovered ? displayRow.bg : undefined }}
              animate={{
                opacity: isHovered ? 1 : 0.3 + i * 0.08,
                x: isHovered ? 0 : -6,
              }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 20,
                delay: i * 0.06,
              }}
            >
              {/* Status dot */}
              <motion.div
                className="flex-shrink-0"
                animate={{
                  scale: isAnimRow && isHovered && daysLeft <= 7 ? [1, 1.3, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                <Circle
                  size={10}
                  fill={displayRow.color}
                  stroke="none"
                />
              </motion.div>

              {/* Status name */}
              <div className="relative h-[14px] w-[72px] flex-shrink-0">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={isAnimRow ? displayRow.status : row.status}
                    className="absolute inset-y-0 left-0 text-[10px] font-bold leading-[14px]"
                    style={{ color: displayRow.color }}
                    initial={isAnimRow ? { opacity: 0, y: -4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isAnimRow ? displayRow.status : row.status}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* Rule */}
              <span className="text-[9px] text-muted-foreground/50 flex-1">
                {row.rule}
              </span>

              {/* Days badge (only on animated row) */}
              {isAnimRow && (
                <motion.span
                  className="text-[9px] font-bold px-2 py-[2px] rounded-full"
                  style={{
                    backgroundColor: displayRow.bg,
                    color: displayRow.color,
                  }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: 0.3 }}
                >
                  {daysLeft}d
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
