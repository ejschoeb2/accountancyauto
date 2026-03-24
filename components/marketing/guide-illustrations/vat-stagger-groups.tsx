"use client";

import { motion } from "framer-motion";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Group {
  label: string;
  color: string;
  bg: string;
  pillBg: string;
  /** 0-indexed month indices that are quarter-ends */
  quarters: number[];
  delay: number;
}

const GROUPS: Group[] = [
  {
    label: "Group 1",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    pillBg: "rgba(139,92,246,0.15)",
    quarters: [2, 5, 8, 11], // Mar, Jun, Sep, Dec
    delay: 0,
  },
  {
    label: "Group 2",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    pillBg: "rgba(59,130,246,0.15)",
    quarters: [0, 3, 6, 9], // Jan, Apr, Jul, Oct
    delay: 0.1,
  },
  {
    label: "Group 3",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    pillBg: "rgba(16,185,129,0.15)",
    quarters: [1, 4, 7, 10], // Feb, May, Aug, Nov
    delay: 0.2,
  },
];

export const VATStaggerGroupsIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-4 py-3 select-none overflow-hidden">
    <div className="flex gap-3">
      {GROUPS.map((group) => (
        <motion.div
          key={group.label}
          className="flex flex-col items-center"
          animate={{
            opacity: isHovered ? 1 : 0.4,
            y: isHovered ? 0 : 6,
          }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 20,
            delay: group.delay,
          }}
        >
          {/* Group header pill */}
          <motion.span
            className="text-[8px] font-bold px-2.5 py-[3px] rounded-full mb-2"
            style={{ backgroundColor: group.pillBg, color: group.color }}
            animate={{ scale: isHovered ? 1 : 0.9 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 18,
              delay: group.delay,
            }}
          >
            {group.label}
          </motion.span>

          {/* Month list */}
          <div className="flex flex-col gap-[2px]">
            {MONTHS.map((month, mi) => {
              const isQuarter = group.quarters.includes(mi);
              return (
                <motion.div
                  key={mi}
                  className="flex items-center gap-1.5 px-2 py-[2px] rounded"
                  style={{
                    backgroundColor: isQuarter && isHovered ? group.bg : "transparent",
                  }}
                  animate={{
                    scale: isQuarter && isHovered ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.2, delay: group.delay + mi * 0.01 }}
                >
                  <span
                    className="text-[8px] w-[22px] font-medium"
                    style={{
                      color: isQuarter ? group.color : undefined,
                      fontWeight: isQuarter ? 700 : 400,
                    }}
                  >
                    {month}
                  </span>

                  {/* Deadline offset — appears on hover for quarter months */}
                  {isQuarter && (
                    <motion.span
                      className="text-[6.5px] font-mono"
                      style={{ color: group.color, opacity: 0.6 }}
                      animate={{
                        opacity: isHovered ? 0.7 : 0,
                        x: isHovered ? 0 : -3,
                      }}
                      transition={{ duration: 0.2, delay: group.delay + 0.3 }}
                    >
                      +1m 7d
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);
