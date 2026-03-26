"use client";

import { motion } from "framer-motion";

interface Group {
  label: string;
  color: string;
  bg: string;
  pillBg: string;
  /** Quarter-end month names */
  quarters: string[];
  delay: number;
}

const GROUPS: Group[] = [
  {
    label: "Group 1",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    pillBg: "rgba(139,92,246,0.15)",
    quarters: ["Mar", "Jun", "Sep", "Dec"],
    delay: 0,
  },
  {
    label: "Group 2",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    pillBg: "rgba(59,130,246,0.15)",
    quarters: ["Jan", "Apr", "Jul", "Oct"],
    delay: 0.1,
  },
  {
    label: "Group 3",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    pillBg: "rgba(16,185,129,0.15)",
    quarters: ["Feb", "May", "Aug", "Nov"],
    delay: 0.2,
  },
];

export const VATStaggerGroupsIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex flex-col items-center justify-center px-4 py-4 select-none overflow-hidden gap-3">
    {GROUPS.map((group) => (
      <motion.div
        key={group.label}
        className="flex items-center gap-3 w-full max-w-[260px]"
        animate={{
          opacity: isHovered ? 1 : 0.4,
          x: isHovered ? 0 : -6,
        }}
        transition={{
          type: "spring",
          stiffness: 240,
          damping: 20,
          delay: group.delay,
        }}
      >
        {/* Group label */}
        <motion.span
          className="text-[10px] font-bold px-2.5 py-[3px] rounded-full flex-shrink-0 w-[60px] text-center"
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

        {/* Quarter months */}
        <div className="flex items-center gap-1.5 flex-1">
          {group.quarters.map((month, mi) => (
            <motion.span
              key={mi}
              className="text-[10px] font-semibold px-2 py-[2px] rounded"
              style={{
                backgroundColor: isHovered ? group.bg : "transparent",
                color: isHovered ? group.color : undefined,
              }}
              animate={{
                opacity: isHovered ? 1 : 0.3,
                scale: isHovered ? 1 : 0.9,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 18,
                delay: group.delay + mi * 0.05,
              }}
            >
              {month}
            </motion.span>
          ))}
        </div>
      </motion.div>
    ))}
  </div>
);
