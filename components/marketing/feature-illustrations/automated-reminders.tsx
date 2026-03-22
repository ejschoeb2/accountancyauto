"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, XCircle, Send } from "lucide-react";

/* ── Queued emails illustration with animated status transitions ── */

interface QueuedRow {
  client: string;
  sendDate: string;
  deadline: string;
  filingType: string;
  template: string;
}

const QUEUED: QueuedRow[] = [
  {
    client: "P. Clarke",
    sendDate: "26 Mar 2026",
    deadline: "31 Jan 2027",
    filingType: "Self Assessment",
    template: "Records Request",
  },
  {
    client: "J. Smith Ltd",
    sendDate: "25 Mar 2026",
    deadline: "01 Jun 2026",
    filingType: "Corp Tax",
    template: "First Reminder",
  },
  {
    client: "Webb & Co",
    sendDate: "28 Mar 2026",
    deadline: "07 Apr 2026",
    filingType: "VAT Return",
    template: "Final Chase",
  },
  {
    client: "Taylor Group",
    sendDate: "01 Apr 2026",
    deadline: "15 Apr 2026",
    filingType: "CT600",
    template: "Second Reminder",
  },
  {
    client: "Harris & Sons",
    sendDate: "02 Apr 2026",
    deadline: "30 Sep 2026",
    filingType: "Companies House",
    template: "First Reminder",
  },
];

type DisplayStatus = "Scheduled" | "Rescheduled" | "Cancelled" | "Sent";

const STATUS_STYLES: Record<
  DisplayStatus,
  { bg: string; text: string; Icon: typeof Clock }
> = {
  Scheduled:   { bg: "rgba(59,130,246,0.1)",   text: "#3b82f6", Icon: Clock },
  Rescheduled: { bg: "rgba(245,158,11,0.1)",   text: "#d97706", Icon: Calendar },
  Cancelled:   { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", Icon: XCircle },
  Sent:        { bg: "rgba(34,197,94,0.1)",     text: "#22c55e", Icon: Send },
};

/* Animation sequence (1-indexed row → target status):
   Step 1: Row 2 → Cancelled
   Step 2: Row 1 → Sent
   Step 3: Row 4 → Rescheduled
   Step 4: Row 3 → Sent
   Step 5: Row 5 → Sent */
const ANIMATION_STEPS: { rowIndex: number; target: DisplayStatus }[] = [
  { rowIndex: 1, target: "Cancelled" },
  { rowIndex: 0, target: "Sent" },
  { rowIndex: 3, target: "Rescheduled" },
  { rowIndex: 2, target: "Sent" },
  { rowIndex: 4, target: "Sent" },
];

const COLUMNS = ["Client", "Send Date", "Deadline", "Filing", "Template", "Status"];

export const AutomatedRemindersIllustration = ({
  isHovered,
}: {
  isHovered: boolean;
}) => {
  const [overrides, setOverrides] = useState<Map<number, DisplayStatus>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      ANIMATION_STEPS.forEach((step, order) => {
        const t = setTimeout(() => {
          setOverrides((prev) => {
            const next = new Map(prev);
            next.set(step.rowIndex, step.target);
            return next;
          });
        }, 1200 + order * 700);
        timerRef.current.push(t);
      });
    } else {
      setOverrides(new Map());
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
        <div className="grid grid-cols-6 gap-2 pb-2.5 border-b border-border/30">
          {COLUMNS.map((col) => (
            <span
              key={col}
              className="text-[9.5px] font-semibold text-muted-foreground/45 uppercase tracking-wide truncate"
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {QUEUED.map((row, i) => {
          const displayStatus: DisplayStatus = overrides.get(i) ?? "Scheduled";
          const isCancelled = displayStatus === "Cancelled";
          const st = STATUS_STYLES[displayStatus];

          return (
            <motion.div
              key={i}
              className="grid grid-cols-6 gap-2 py-3.5 border-b border-border/15 items-center"
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: isCancelled
                  ? isHovered ? 0.5 : 0.2
                  : isHovered ? 1 : 0.3 + i * 0.1,
                y: isHovered ? 0 : 4,
              }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              {/* Client */}
              <span className={`text-[10.5px] font-semibold text-foreground/75 truncate ${isCancelled ? "line-through" : ""}`}>
                {row.client}
              </span>

              {/* Send Date */}
              <span className={`text-[9.5px] text-muted-foreground/50 truncate ${isCancelled ? "line-through" : ""}`}>
                {row.sendDate}
              </span>

              {/* Deadline */}
              <span className={`text-[9.5px] text-muted-foreground/50 truncate ${isCancelled ? "line-through" : ""}`}>
                {row.deadline}
              </span>

              {/* Filing Type */}
              <span className={`text-[9.5px] text-muted-foreground/50 truncate ${isCancelled ? "line-through" : ""}`}>
                {row.filingType}
              </span>

              {/* Template */}
              <span className={`text-[9.5px] text-muted-foreground/50 truncate ${isCancelled ? "line-through" : ""}`}>
                {row.template}
              </span>

              {/* Status badge — animates between states */}
              <div className="relative h-[20px]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={displayStatus}
                    className="absolute inset-y-0 left-0 inline-flex items-center gap-[3px] text-[8.5px] font-semibold px-2 py-[3px] rounded whitespace-nowrap"
                    style={{ backgroundColor: st.bg, color: st.text }}
                    initial={
                      overrides.has(i)
                        ? { opacity: 0, scale: 0.8 }
                        : { opacity: isHovered ? 1 : 0.4 }
                    }
                    animate={{ opacity: isHovered ? 1 : 0.4, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <st.Icon size={9} />
                    {displayStatus}
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
