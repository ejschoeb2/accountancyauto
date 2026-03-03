"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";

const nodes = [
  { day: "Day 1",  label: "First reminder",  color: "#3b82f6" },
  { day: "Day 7",  label: "Follow-up",       color: "#8b5cf6" },
  { day: "Day 14", label: "Final chase",      color: "#ef4444" },
];

export const ReminderSchedulesIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-8 select-none">
    <div className="flex items-start gap-0 w-full max-w-md justify-center">
      {nodes.map((node, i) => (
        <div key={node.day} className="flex items-start">
          {/* Node */}
          <motion.div
            className="flex flex-col items-center gap-1.5"
            initial={{ opacity: 0.3, y: 6 }}
            animate={{ opacity: isHovered ? 1 : 0.3, y: isHovered ? 0 : 6 }}
            transition={{ delay: i * 0.14, duration: 0.3 }}
          >
            {/* Day label */}
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
              {node.day}
            </span>

            {/* Email card */}
            <motion.div
              className="relative w-16 h-11 rounded-lg border border-border/60 flex items-center justify-center"
              animate={{
                backgroundColor: isHovered ? `${node.color}10` : "rgba(0,0,0,0)",
                borderColor: isHovered ? `${node.color}40` : "rgba(0,0,0,0.1)",
              }}
              transition={{ delay: i * 0.14 + 0.1 }}
            >
              <motion.div
                animate={{ scale: isHovered ? 1 : 0.7, rotate: isHovered ? 0 : -10 }}
                transition={{ type: "spring", stiffness: 300, damping: 16, delay: i * 0.14 + 0.08 }}
              >
                <Mail size={16} style={{ color: node.color }} />
              </motion.div>

              {/* Send pulse */}
              {isHovered && (
                <motion.div
                  className="absolute inset-0 rounded-lg border"
                  style={{ borderColor: node.color }}
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.3 }}
                  transition={{ duration: 1, delay: i * 0.14 + 0.4, repeat: Infinity, repeatDelay: 1.5 }}
                />
              )}
            </motion.div>

            {/* Action label */}
            <motion.span
              className="text-[7px] text-muted-foreground/60"
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ delay: i * 0.14 + 0.2 }}
            >
              {node.label}
            </motion.span>
          </motion.div>

          {/* Connector arrow */}
          {i < nodes.length - 1 && (
            <motion.div
              className="mt-[30px] mx-2"
              animate={{ opacity: isHovered ? 0.4 : 0.1 }}
              transition={{ delay: i * 0.14 + 0.2 }}
            >
              <svg width="32" height="8" viewBox="0 0 32 8">
                <motion.path
                  d="M0 4 H26 M22 1 L27 4 L22 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-muted-foreground"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isHovered ? 1 : 0 }}
                  transition={{ delay: i * 0.14 + 0.25, duration: 0.35 }}
                />
              </svg>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  </div>
);
