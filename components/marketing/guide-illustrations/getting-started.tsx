"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, AlertTriangle, Clock, TrendingUp } from "lucide-react";

interface MetricCard {
  label: string;
  value: number;
  animatedValue: number;
  color: string;
  bg: string;
  icon: typeof AlertTriangle;
}

const METRICS: MetricCard[] = [
  { label: "Overdue",     value: 3,  animatedValue: 2,  color: "#ef4444", bg: "rgba(239,68,68,0.08)",  icon: AlertTriangle },
  { label: "Critical",    value: 7,  animatedValue: 6,  color: "#f97316", bg: "rgba(249,115,22,0.08)", icon: Clock },
  { label: "Approaching", value: 12, animatedValue: 12, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: TrendingUp },
  { label: "Complete",    value: 24, animatedValue: 25, color: "#22c55e", bg: "rgba(34,197,94,0.08)",  icon: CheckCircle },
];

interface SetupStep {
  label: string;
  delay: number;
}

const SETUP_STEPS: SetupStep[] = [
  { label: "Create organisation",      delay: 0.08 },
  { label: "Add your first client",    delay: 0.16 },
  { label: "Configure filing types",   delay: 0.24 },
  { label: "Set up email templates",   delay: 0.32 },
  { label: "Connect sending domain",   delay: 0.40 },
];

export const GettingStartedIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [checked, setChecked] = useState<Set<number>>(new Set([0, 1]));
  const [metricValues, setMetricValues] = useState(METRICS.map((m) => m.value));
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setChecked(new Set([0, 1]));
      setMetricValues(METRICS.map((m) => m.value));

      const t0 = setTimeout(() => setChecked(new Set([0, 1, 2])), 800);
      const t1 = setTimeout(() => setChecked(new Set([0, 1, 2, 3])), 1300);
      const t2 = setTimeout(() => {
        setMetricValues(METRICS.map((m) => m.animatedValue));
      }, 600);

      timerRef.current = [t0, t1, t2];
    } else {
      setChecked(new Set([0, 1]));
      setMetricValues(METRICS.map((m) => m.value));
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex flex-col justify-center px-4 py-3 select-none overflow-hidden">
      {/* Metric cards row */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {METRICS.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              className="rounded-lg px-2 py-2 flex flex-col items-center gap-1"
              style={{ backgroundColor: metric.bg }}
              animate={{
                opacity: isHovered ? 1 : 0.4,
                y: isHovered ? 0 : 4,
              }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 20,
                delay: i * 0.06,
              }}
            >
              <Icon size={10} style={{ color: metric.color }} strokeWidth={2} />
              <motion.span
                className="text-[12px] font-bold tabular-nums"
                style={{ color: metric.color }}
                key={metricValues[i]}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                {metricValues[i]}
              </motion.span>
              <span className="text-[7px] text-muted-foreground/50 font-medium">
                {metric.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Setup checklist */}
      <motion.div
        className="rounded-lg border border-border/30 bg-background/60 px-3 py-2"
        animate={{ opacity: isHovered ? 1 : 0.35 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider block mb-1.5">
          Setup Progress
        </span>
        <div className="space-y-[4px]">
          {SETUP_STEPS.map((step, i) => {
            const isDone = checked.has(i);
            return (
              <motion.div
                key={i}
                className="flex items-center gap-1.5"
                animate={{
                  opacity: isHovered ? 1 : 0.4,
                  x: isHovered ? 0 : -3,
                }}
                transition={{ duration: 0.2, delay: step.delay }}
              >
                <motion.div
                  animate={{
                    scale: isDone ? 1 : 0.9,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 14 }}
                >
                  {isDone ? (
                    <CheckCircle size={10} className="text-emerald-500" strokeWidth={2.5} />
                  ) : (
                    <Circle size={10} className="text-muted-foreground/25" strokeWidth={2} />
                  )}
                </motion.div>
                <span
                  className={`text-[8px] leading-none ${isDone ? "text-emerald-600/70 line-through" : "text-muted-foreground/50"}`}
                >
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
