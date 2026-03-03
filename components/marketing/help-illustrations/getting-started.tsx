"use client";

import { motion } from "framer-motion";
import { UserPlus, Upload, Rocket } from "lucide-react";

const steps = [
  { icon: UserPlus, label: "Sign Up",         color: "#8b5cf6" },
  { icon: Upload,   label: "Import Clients",  color: "#3b82f6" },
  { icon: Rocket,   label: "Go Live",         color: "#10b981" },
];

export const GettingStartedIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-8 select-none">
    <div className="flex items-center w-full max-w-md justify-between">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <motion.div className="flex flex-col items-center gap-2.5">
            {/* Step circle */}
            <motion.div
              className="relative w-14 h-14 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: step.color }}
              animate={{
                backgroundColor: isHovered ? step.color : "rgba(0,0,0,0)",
                scale: isHovered ? 1 : 0.85,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: i * 0.12 }}
            >
              <step.icon
                size={22}
                style={{ color: isHovered ? "#fff" : step.color }}
                className="transition-colors duration-200"
              />

              {/* Completion ring */}
              <motion.div
                className="absolute inset-[-3px] rounded-full border-2"
                style={{ borderColor: step.color }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: isHovered ? 0.3 : 0,
                  scale: isHovered ? 1.15 : 0.8,
                }}
                transition={{ delay: i * 0.12 + 0.2, duration: 0.4 }}
              />
            </motion.div>

            {/* Label */}
            <motion.span
              className="text-[10px] font-semibold text-muted-foreground tracking-wide"
              animate={{ opacity: isHovered ? 1 : 0.4 }}
              transition={{ delay: i * 0.12 }}
            >
              {step.label}
            </motion.span>
          </motion.div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <motion.div
              className="mx-4 mt-[-20px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 0.4 : 0.15 }}
              transition={{ delay: i * 0.12 + 0.15 }}
            >
              <svg width="40" height="2" viewBox="0 0 40 2">
                <motion.line
                  x1="0" y1="1" x2="40" y2="1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="text-border"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isHovered ? 1 : 0 }}
                  transition={{ delay: i * 0.12 + 0.2, duration: 0.4 }}
                />
              </svg>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  </div>
);
