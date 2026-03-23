"use client";

import { motion } from "framer-motion";
import { Mail, FileUp, RefreshCw, Clock } from "lucide-react";

const EVENTS = [
  { time: "09:41",  icon: Mail,      color: "#6366f1", label: "Reminder sent to J. Smith",       delay: 0.08 },
  { time: "10:12",  icon: FileUp,    color: "#8b5cf6", label: "P60 uploaded by client",           delay: 0.18 },
  { time: "10:12",  icon: RefreshCw, color: "#10b981", label: "Status → Records Received",       delay: 0.28 },
  { time: "10:15",  icon: Clock,     color: "#f59e0b", label: "Next reminder cancelled",          delay: 0.38 },
];

export const AuditTrailIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-3 py-2">
    <div className="w-full max-w-[180px]">

      <div className="relative">
        {/* Vertical timeline line */}
        <motion.div
          className="absolute left-[3px] top-1 bottom-1 w-[1.5px] bg-border/30 rounded-full"
          animate={{ opacity: isHovered ? 1 : 0.3 }}
          transition={{ duration: 0.3 }}
        />

        {/* Events */}
        <div className="space-y-[8px]">
          {EVENTS.map((evt, i) => {
            const Icon = evt.icon;
            return (
              <motion.div
                key={i}
                className="flex items-start gap-2 pl-[10px] relative"
                animate={{
                  opacity: isHovered ? 1 : 0.35,
                  x: isHovered ? 0 : -4,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: evt.delay,
                }}
              >
                {/* Dot on timeline */}
                <motion.div
                  className="absolute left-0 top-[3px] w-[7px] h-[7px] rounded-full border-[1.5px]"
                  style={{ borderColor: evt.color, backgroundColor: `${evt.color}20` }}
                  animate={{ scale: isHovered ? 1 : 0.6 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 16,
                    delay: evt.delay,
                  }}
                />

                {/* Time */}
                <span className="text-[7px] text-muted-foreground/40 tabular-nums w-[22px] flex-shrink-0 pt-[1px]">
                  {evt.time}
                </span>

                {/* Icon + label */}
                <div className="flex items-center gap-1 min-w-0">
                  <Icon size={9} style={{ color: evt.color }} strokeWidth={2} className="flex-shrink-0" />
                  <span className="text-[8px] text-muted-foreground/60 leading-tight">
                    {evt.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

    </div>
  </div>
);
