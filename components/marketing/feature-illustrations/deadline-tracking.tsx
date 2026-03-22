"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Fake client data mimicking the /clients table, sorted by deadline soonest ── */

type Status = "Overdue" | "Critical" | "Approaching" | "On Track" | "Records Received" | "Completed";

interface ClientRow {
  name: string;
  nextDeadline: string;
  deadlineType: string;
  reminders: "Active" | "Paused";
  status: Status;
  docReceived: number;
  docRequired: number;
}

const CLIENTS: ClientRow[] = [
  {
    name: "Taylor Group",
    nextDeadline: "15 Mar 2026",
    deadlineType: "CT600",
    reminders: "Active",
    status: "Overdue",
    docReceived: 0,
    docRequired: 3,
  },
  {
    name: "J. Smith Ltd",
    nextDeadline: "01 Apr 2026",
    deadlineType: "Corp Tax",
    reminders: "Active",
    status: "Approaching",
    docReceived: 1,
    docRequired: 4,
  },
  {
    name: "Webb & Co",
    nextDeadline: "07 Apr 2026",
    deadlineType: "VAT Return",
    reminders: "Paused",
    status: "On Track",
    docReceived: 0,
    docRequired: 2,
  },
  {
    name: "Harris & Sons",
    nextDeadline: "30 Sep 2026",
    deadlineType: "Companies House",
    reminders: "Active",
    status: "Records Received",
    docReceived: 3,
    docRequired: 3,
  },
  {
    name: "P. Clarke",
    nextDeadline: "31 Jan 2027",
    deadlineType: "Self Assessment",
    reminders: "Active",
    status: "On Track",
    docReceived: 1,
    docRequired: 5,
  },
];

/* Row index that animates On Track → Records Received */
const ANIMATING_ROW = 4; // P. Clarke

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Overdue:            { bg: "rgba(239,68,68,0.1)",   text: "#ef4444" },
  Critical:           { bg: "rgba(249,115,22,0.1)",  text: "#f97316" },
  Approaching:        { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b" },
  "On Track":         { bg: "rgba(59,130,246,0.1)",  text: "#3b82f6" },
  "Records Received": { bg: "rgba(139,92,246,0.1)",  text: "#8b5cf6" },
  Completed:          { bg: "rgba(34,197,94,0.1)",   text: "#22c55e" },
};

const REMINDER_STYLES: Record<string, { bg: string; text: string }> = {
  Active: { bg: "rgba(34,197,94,0.1)", text: "#22c55e" },
  Paused: { bg: "rgba(156,163,175,0.1)", text: "#9ca3af" },
};

const COLUMNS = ["Client", "Next Deadline", "Deadline Type", "Reminders", "Status"];

/* ── Inline progress ring ── */
const ProgressRing = ({
  progress,
  color,
  size = 14,
}: {
  progress: number;
  color: string;
  size?: number;
}) => {
  const sw = 2;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90 flex-shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        opacity={0.2}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={circ}
        strokeLinecap="round"
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </svg>
  );
};

export const DeadlineTrackingIllustration = ({
  isHovered,
}: {
  isHovered: boolean;
}) => {
  const [animatedStatus, setAnimatedStatus] = useState<Status | null>(null);
  const [progressOverrides, setProgressOverrides] = useState<Map<number, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setAnimatedStatus(null);
      setProgressOverrides(new Map());

      /* Row 0 (Taylor, Overdue): 0/3 → 1/3 at 1s */
      const t0 = setTimeout(() => {
        setProgressOverrides((prev) => new Map(prev).set(0, 1 / 3));
      }, 1000);

      /* Row 1 (J. Smith, Approaching): 1/4 → 2/4 at 1.5s */
      const t1 = setTimeout(() => {
        setProgressOverrides((prev) => new Map(prev).set(1, 2 / 4));
      }, 1500);

      /* Row 4 (P. Clarke, On Track): fill ring then flip status */
      const t2 = setTimeout(() => {
        setProgressOverrides((prev) => new Map(prev).set(4, 3 / 5));
      }, 800);
      const t3 = setTimeout(() => {
        setProgressOverrides((prev) => new Map(prev).set(4, 1));
      }, 1600);
      const t4 = setTimeout(() => setAnimatedStatus("Records Received"), 2200);

      timerRef.current = [t0, t1, t2, t3, t4];
    } else {
      setAnimatedStatus(null);
      setProgressOverrides(new Map());
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex flex-col px-4 py-4 select-none overflow-hidden justify-center">
      <div className="flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-5 gap-2 pb-2.5 border-b border-border/30">
          {COLUMNS.map((col) => (
            <span
              key={col}
              className="text-[9px] font-semibold text-muted-foreground/45 uppercase tracking-wide truncate"
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {CLIENTS.map((client, i) => {
          const isAnimRow = i === ANIMATING_ROW;
          const currentStatus = isAnimRow && animatedStatus ? animatedStatus : client.status;
          const st = STATUS_STYLES[currentStatus];
          const rm = REMINDER_STYLES[client.reminders];

          const baseProgress = client.docReceived / Math.max(client.docRequired, 1);
          const ringProgress = progressOverrides.has(i)
            ? progressOverrides.get(i)!
            : baseProgress;

          return (
            <motion.div
              key={i}
              className="grid grid-cols-5 gap-2 py-3 border-b border-border/15 items-center"
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: isHovered ? 1 : 0.3 + i * 0.1,
                y: isHovered ? 0 : 4,
              }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              {/* Client Name */}
              <span className="text-[10px] font-semibold text-foreground/75 truncate">
                {client.name}
              </span>

              {/* Next Deadline */}
              <span className="text-[9px] text-muted-foreground/50 truncate">
                {client.nextDeadline}
              </span>

              {/* Deadline Type */}
              <span className="text-[9px] text-muted-foreground/50 truncate">
                {client.deadlineType}
              </span>

              {/* Reminders badge */}
              <div>
                <motion.span
                  className="inline-flex text-[8px] font-semibold px-2 py-[3px] rounded"
                  style={{ backgroundColor: rm.bg, color: rm.text }}
                  animate={{ opacity: isHovered ? 1 : 0.4 }}
                  transition={{ duration: 0.2, delay: i * 0.04 + 0.1 }}
                >
                  {client.reminders}
                </motion.span>
              </div>

              {/* Status badge with progress ring */}
              <div className="relative h-[20px]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentStatus}
                    className="absolute inset-y-0 left-0 inline-flex items-center gap-1 text-[8px] font-semibold px-2 py-[3px] rounded whitespace-nowrap"
                    style={{ backgroundColor: st.bg, color: st.text }}
                    initial={isAnimRow && animatedStatus ? { opacity: 0, scale: 0.8 } : false}
                    animate={{ opacity: isHovered ? 1 : 0.4, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.25 }}
                  >
                    {currentStatus}
                    {client.docRequired > 0 && (
                      <ProgressRing
                        progress={isHovered ? ringProgress : 0}
                        color={st.text}
                      />
                    )}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
