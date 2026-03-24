"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Clock, SlidersHorizontal, Send, CheckCircle, Pause } from "lucide-react";

interface PipelineNode {
  icon: typeof Clock;
  label: string;
  sublabel: string;
  color: string;
}

const NODES: PipelineNode[] = [
  { icon: Clock,              label: "Daily check",   sublabel: "Cron runs at 8am", color: "#8b5cf6" },
  { icon: SlidersHorizontal,  label: "Match stage",   sublabel: "Days remaining?",  color: "#3b82f6" },
  { icon: Send,               label: "Send email",    sublabel: "Template + vars",  color: "#22c55e" },
  { icon: CheckCircle,        label: "Complete?",      sublabel: "Docs received?",   color: "#10b981" },
];

export const ReminderPipelineIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [activeNode, setActiveNode] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setActiveNode(-1);
      NODES.forEach((_, i) => {
        const t = setTimeout(() => setActiveNode(i), 400 + i * 500);
        timerRef.current.push(t);
      });
    } else {
      setActiveNode(-1);
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 py-4 select-none overflow-hidden">
      {/* Pipeline nodes */}
      <div className="flex items-start gap-1">
        {NODES.map((node, i) => {
          const Icon = node.icon;
          const isActive = i <= activeNode;
          const isCurrently = i === activeNode;

          return (
            <div key={i} className="flex items-start">
              {/* Node */}
              <motion.div
                className="flex flex-col items-center w-[56px]"
                animate={{
                  opacity: isHovered ? 1 : 0.35,
                  y: isHovered ? 0 : 4,
                }}
                transition={{
                  type: "spring",
                  stiffness: 240,
                  damping: 20,
                  delay: i * 0.06,
                }}
              >
                {/* Icon circle */}
                <motion.div
                  className="w-[32px] h-[32px] rounded-full border-2 flex items-center justify-center mb-1.5"
                  animate={{
                    borderColor: isActive ? node.color : "rgba(156,163,175,0.2)",
                    backgroundColor: isCurrently
                      ? `${node.color}15`
                      : "transparent",
                    scale: isCurrently ? 1.1 : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 18,
                  }}
                >
                  <Icon
                    size={14}
                    strokeWidth={2}
                    style={{ color: isActive ? node.color : "#9ca3af" }}
                  />
                </motion.div>

                {/* Label */}
                <span
                  className="text-[8px] font-bold text-center leading-tight"
                  style={{ color: isActive ? node.color : undefined }}
                >
                  {node.label}
                </span>

                {/* Sublabel */}
                <motion.span
                  className="text-[7px] text-muted-foreground/40 text-center leading-tight mt-[2px]"
                  animate={{ opacity: isHovered ? 0.7 : 0 }}
                  transition={{ duration: 0.2, delay: i * 0.06 + 0.1 }}
                >
                  {node.sublabel}
                </motion.span>
              </motion.div>

              {/* Connector arrow */}
              {i < NODES.length - 1 && (
                <motion.div
                  className="flex items-center mt-[14px] mx-[-2px]"
                  animate={{
                    opacity: isHovered ? 0.5 : 0.15,
                  }}
                  transition={{ duration: 0.2, delay: i * 0.06 + 0.05 }}
                >
                  <div className="w-[8px] border-t border-dashed border-border/50" />
                  <span className="text-[8px] text-muted-foreground/30">›</span>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skip fork — shown below "Send email" */}
      <motion.div
        className="flex items-center gap-1.5 mt-2.5"
        animate={{
          opacity: isHovered ? 0.5 : 0,
          y: isHovered ? 0 : 4,
        }}
        transition={{ duration: 0.25, delay: 0.35 }}
      >
        <Pause size={8} className="text-muted-foreground/40" strokeWidth={2} />
        <span className="text-[7px] text-muted-foreground/40 font-medium">
          Paused clients skip send
        </span>
      </motion.div>
    </div>
  );
};
