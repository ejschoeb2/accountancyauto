"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";

const NODES = [
  { label: "Day 1",  delay: 0    },
  { label: "Day 7",  delay: 0.22 },
  { label: "Day 14", delay: 0.44 },
];

export const AutomatedRemindersIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="relative w-full h-full flex flex-col justify-center gap-4 px-5 py-3">

    {/* Vertical stem */}
    <div className="absolute left-[calc(1.25rem+4px)] top-4 bottom-4 w-px bg-border/50" />

    {NODES.map((node, i) => (
      <div key={i} className="relative flex items-center gap-3 z-10">

        {/* Expanding pulse ring */}
        <motion.div
          className="absolute rounded-full border border-blue-500/40"
          style={{
            left:   "calc(1.25rem - 5px)",
            width:  18,
            height: 18,
          }}
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
          style={{ width: 10, height: 10 }}
          animate={{
            backgroundColor: isHovered ? "rgb(59 130 246)" : "rgba(0,0,0,0)",
            boxShadow:        isHovered ? "0 0 7px 1px rgba(59,130,246,0.45)" : "none",
          }}
          transition={{ duration: 0.2, delay: node.delay }}
        />

        {/* Label */}
        <span className="text-[9px] text-muted-foreground/45 font-medium w-9 leading-none">
          {node.label}
        </span>

        {/* Envelope */}
        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -5 }}
          transition={{ duration: 0.18, delay: node.delay + 0.11 }}
        >
          <Mail size={12} className="text-blue-400" strokeWidth={2} />
        </motion.div>
      </div>
    ))}
  </div>
);
