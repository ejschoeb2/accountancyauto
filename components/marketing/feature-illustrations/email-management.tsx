"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Link } from "lucide-react";

/* ── Template editor illustration with typing animation ── */

type Segment =
  | { type: "text"; content: string }
  | { type: "pill"; label: string }
  | { type: "portal"; label: string };

const SUBJECT_SEGMENTS: Segment[] = [
  { type: "text", content: "Your " },
  { type: "pill", label: "Filing Type" },
  { type: "text", content: " is due on " },
  { type: "pill", label: "Deadline" },
];

const BODY_SEGMENTS: Segment[] = [
  { type: "text", content: "Dear " },
  { type: "pill", label: "Client Name" },
  { type: "text", content: ",\n\nThis is a friendly reminder that your " },
  { type: "pill", label: "Filing Type" },
  { type: "text", content: " is due on " },
  { type: "pill", label: "Deadline" },
  { type: "text", content: ". You have " },
  { type: "pill", label: "Days Until Deadline" },
  { type: "text", content: " days remaining.\n\nPlease upload your documents:\n" },
  { type: "portal", label: "https://app.prompt.so/portal/abc123" },
  { type: "text", content: "\n\nKind regards,\n" },
  { type: "pill", label: "Accountant Name" },
];

interface Step {
  segIndex: number;
  charIndex?: number;
}

function buildSteps(segments: Segment[]): Step[] {
  const steps: Step[] = [];
  segments.forEach((seg, si) => {
    if (seg.type === "text") {
      for (let ci = 0; ci < seg.content.length; ci++) {
        steps.push({ segIndex: si, charIndex: ci });
      }
    } else {
      steps.push({ segIndex: si });
    }
  });
  return steps;
}

const subjectSteps = buildSteps(SUBJECT_SEGMENTS);
const bodySteps = buildSteps(BODY_SEGMENTS);
const TOTAL_STEPS = subjectSteps.length + bodySteps.length;

function renderSegments(
  segments: Segment[],
  steps: Step[],
  visibleCount: number,
) {
  const segVis: Map<number, number | "full"> = new Map();
  for (let i = 0; i < visibleCount; i++) {
    const step = steps[i];
    const seg = segments[step.segIndex];
    if (seg.type === "text" && step.charIndex !== undefined) {
      segVis.set(step.segIndex, step.charIndex + 1);
    } else {
      segVis.set(step.segIndex, "full");
    }
  }

  return segments.map((seg, si) => {
    const vis = segVis.get(si);
    if (vis === undefined) return null;

    if (seg.type === "text") {
      const chars = typeof vis === "number" ? vis : seg.content.length;
      return (
        <span key={si} className="whitespace-pre-wrap">
          {seg.content.slice(0, chars)}
        </span>
      );
    }
    if (seg.type === "pill") {
      return (
        <motion.span
          key={si}
          className="inline-flex text-[10px] font-medium text-sky-600 bg-sky-500/10 px-1.5 py-[2px] rounded mx-[1px] align-baseline"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          {seg.label}
        </motion.span>
      );
    }
    /* portal */
    return (
      <motion.span
        key={si}
        className="inline-flex items-center gap-[3px] text-[10px] font-medium text-violet-600 bg-violet-500/10 px-1.5 py-[2px] rounded mx-[1px] underline decoration-violet-400/50 align-baseline"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
      >
        <Link size={7} className="text-violet-500 flex-shrink-0" />
        {seg.label}
      </motion.span>
    );
  });
}

export const EmailManagementIllustration = ({
  isHovered,
}: {
  isHovered: boolean;
}) => {
  const [step, setStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isHovered) {
      setStep(0);
      const startTimer = setTimeout(() => {
        let current = 0;
        intervalRef.current = setInterval(() => {
          current++;
          if (current >= TOTAL_STEPS) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStep(current);
        }, 22);
      }, 200);
      return () => {
        clearTimeout(startTimer);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setStep(0);
    }
  }, [isHovered]);

  const subjectVisible = Math.min(step, subjectSteps.length);
  const bodyVisible = Math.max(0, step - subjectSteps.length);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center pl-[12%] pr-6 py-4 select-none overflow-hidden">
      {/* Toolbar */}
      <motion.div
        className="flex items-center gap-2.5 mb-3 w-full max-w-[75%]"
        animate={{ opacity: isHovered ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      >
        {/* Insert Variable button */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-500/10">
          <Plus size={10} className="text-sky-500" />
          <span className="text-[9px] font-semibold text-sky-500">
            Insert Variable
          </span>
        </div>

        {/* Insert Portal button */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-500/10">
          <Link size={10} className="text-violet-500" />
          <span className="text-[9px] font-semibold text-violet-500">
            Insert Portal
          </span>
        </div>
      </motion.div>

      {/* Editor card — more rounded, shadow, less wide */}
      <div className="flex-1 flex flex-col rounded-xl border border-border/40 bg-background shadow-sm overflow-hidden w-full max-w-[75%]">
        {/* Subject line */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/30 min-h-[32px]">
          <span className="text-[10px] font-semibold text-muted-foreground/50 flex-shrink-0">
            Subject:
          </span>
          <span className="text-[11px] text-foreground/60 flex items-center flex-wrap">
            {renderSegments(SUBJECT_SEGMENTS, subjectSteps, subjectVisible)}
            {isHovered && subjectVisible < subjectSteps.length && (
              <motion.span
                className="inline-block w-[1px] h-[12px] bg-foreground/60 ml-[1px]"
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 1, repeat: Infinity, times: [0, 0.49, 0.5, 1] }}
              />
            )}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 px-3.5 py-3 text-[11px] leading-[1.7] text-foreground/60">
          {renderSegments(BODY_SEGMENTS, bodySteps, bodyVisible)}
          {isHovered &&
            subjectVisible >= subjectSteps.length &&
            bodyVisible < bodySteps.length && (
              <motion.span
                className="inline-block w-[1px] h-[11px] bg-foreground/60 ml-[1px] align-baseline"
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 1, repeat: Infinity, times: [0, 0.49, 0.5, 1] }}
              />
            )}
        </div>
      </div>
    </div>
  );
};
