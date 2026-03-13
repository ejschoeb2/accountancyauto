"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";

const NODES = [
  { label: "Day 1",  delay: 0    },
  { label: "Day 7",  delay: 0.18 },
  { label: "Day 14", delay: 0.36 },
];

export const AutomatedRemindersIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="relative w-full h-full flex items-center justify-center px-4 py-3">
    <div className="relative flex items-center justify-between w-full max-w-[200px]">

      {/* Horizontal connector line */}
      <div className="absolute top-1/2 left-[8px] right-[8px] h-px bg-border/50 -translate-y-1/2" />

      {NODES.map((node, i) => (
        <div key={i} className="relative flex flex-col items-center gap-2 z-10">

          {/* Expanding pulse ring */}
          <motion.div
            className="absolute rounded-full border border-blue-500/40"
            style={{ width: 22, height: 22, top: -2 }}
            animate={isHovered
              ? { opacity: [0, 0.55, 0], scale: [0.4, 1.7, 2.3] }
              : { opacity: 0, scale: 0.4 }
            }
            transition={isHovered
              ? { duration: 1.15, delay: node.delay + 0.12, repeat: Infinity, ease: "easeOut" }
              : { duration: 0.1 }
            }
          />

          {/* Node dot */}
          <motion.div
            className="rounded-full border-2 border-blue-500 flex-shrink-0"
            style={{ width: 14, height: 14 }}
            animate={{
              backgroundColor: isHovered ? "rgb(59 130 246)" : "rgba(0,0,0,0)",
              boxShadow:        isHovered ? "0 0 7px 1px rgba(59,130,246,0.45)" : "none",
            }}
            transition={{ duration: 0.2, delay: node.delay }}
          />

          {/* Envelope */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
            transition={{ duration: 0.18, delay: node.delay + 0.11 }}
          >
            <Mail size={11} className="text-blue-400" strokeWidth={2} />
          </motion.div>

          {/* Label */}
          <span className="text-[8px] text-muted-foreground/45 font-medium leading-none">
            {node.label}
          </span>
        </div>
      ))}
    </div>
  </div>
);
