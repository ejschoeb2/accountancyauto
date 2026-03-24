"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface PillDef {
  variable: string;
  resolved: string;
}

const PILLS: PillDef[] = [
  { variable: "Client Name",   resolved: "J. Smith Ltd" },
  { variable: "Filing Type",   resolved: "CT600" },
  { variable: "Deadline",      resolved: "01 Apr 2026" },
  { variable: "Portal Link",   resolved: "prompt.so/portal/x7k" },
  { variable: "Accountant",    resolved: "Sarah Chen" },
];

/* Left template segments */
const TEMPLATE_SUBJECT = ["Your ", "{Filing Type}", " is due on ", "{Deadline}"];
const TEMPLATE_BODY = [
  "Dear ", "{Client Name}", ",\n\nYour ", "{Filing Type}",
  " filing is due ", "{Deadline}", ".\n\nUpload docs:\n", "{Portal Link}",
  "\n\nKind regards,\n", "{Accountant}",
];

/* Right resolved segments */
const RESOLVED_SUBJECT = ["Your ", "CT600", " is due on ", "01 Apr 2026"];
const RESOLVED_BODY = [
  "Dear ", "J. Smith Ltd", ",\n\nYour ", "CT600",
  " filing is due ", "01 Apr 2026", ".\n\nUpload docs:\n", "prompt.so/portal/x7k",
  "\n\nKind regards,\n", "Sarah Chen",
];

const isPill = (text: string) => text.startsWith("{") && text.endsWith("}");
const isResolved = (_text: string, i: number) => i % 2 === 1; // odd indices are values

const TemplateSegment = ({ text, animate: anim }: { text: string; animate: boolean }) => {
  if (isPill(text)) {
    return (
      <motion.span
        className="inline-flex text-[8px] font-medium text-sky-600 bg-sky-500/10 px-1 py-[1px] rounded mx-[1px] align-baseline"
        animate={{ opacity: anim ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      >
        {text}
      </motion.span>
    );
  }
  return <span className="whitespace-pre-wrap">{text}</span>;
};

const ResolvedSegment = ({ text, index, show }: { text: string; index: number; show: boolean }) => {
  if (isResolved(text, index)) {
    return (
      <motion.span
        className="inline-flex text-[8px] font-semibold text-violet-600 bg-violet-500/10 px-1 py-[1px] rounded mx-[1px] align-baseline"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.7 }}
        transition={{ type: "spring", stiffness: 350, damping: 18, delay: 0.05 * index }}
      >
        {text}
      </motion.span>
    );
  }
  return <span className="whitespace-pre-wrap">{text}</span>;
};

export const EmailTemplatesIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [showResolved, setShowResolved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isHovered) {
      setShowResolved(false);
      timerRef.current = setTimeout(() => setShowResolved(true), 800);
    } else {
      setShowResolved(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex items-center justify-center px-3 py-3 select-none overflow-hidden">
      <div className="flex items-stretch gap-2 w-full max-w-[320px]">
        {/* Left: template */}
        <motion.div
          className="flex-1 flex flex-col rounded-lg border border-border/40 bg-background/80 shadow-sm overflow-hidden"
          animate={{ opacity: isHovered ? 1 : 0.4 }}
          transition={{ duration: 0.3 }}
        >
          <div className="px-2.5 py-1.5 border-b border-border/20">
            <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider">
              Template
            </span>
          </div>
          <div className="px-2.5 py-1.5 border-b border-border/20 min-h-[18px]">
            <span className="text-[8px] text-foreground/50 flex flex-wrap items-center">
              {TEMPLATE_SUBJECT.map((seg, i) => (
                <TemplateSegment key={i} text={seg} animate={isHovered} />
              ))}
            </span>
          </div>
          <div className="px-2.5 py-2 flex-1 text-[8px] leading-[1.65] text-foreground/50">
            {TEMPLATE_BODY.map((seg, i) => (
              <TemplateSegment key={i} text={seg} animate={isHovered} />
            ))}
          </div>
        </motion.div>

        {/* Arrow */}
        <motion.div
          className="flex items-center"
          animate={{
            opacity: showResolved ? 0.6 : 0.15,
            x: showResolved ? 0 : -3,
          }}
          transition={{ duration: 0.25 }}
        >
          <ArrowRight size={14} className="text-muted-foreground/40" />
        </motion.div>

        {/* Right: resolved */}
        <motion.div
          className="flex-1 flex flex-col rounded-lg border border-violet-500/20 bg-violet-500/[0.02] shadow-sm overflow-hidden"
          animate={{
            opacity: showResolved ? 1 : 0.2,
            x: showResolved ? 0 : 4,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          <div className="px-2.5 py-1.5 border-b border-violet-500/10">
            <span className="text-[7px] font-bold text-violet-500/50 uppercase tracking-wider">
              Preview
            </span>
          </div>
          <div className="px-2.5 py-1.5 border-b border-violet-500/10 min-h-[18px]">
            <span className="text-[8px] text-foreground/50 flex flex-wrap items-center">
              {RESOLVED_SUBJECT.map((seg, i) => (
                <ResolvedSegment key={i} text={seg} index={i} show={showResolved} />
              ))}
            </span>
          </div>
          <div className="px-2.5 py-2 flex-1 text-[8px] leading-[1.65] text-foreground/50">
            {RESOLVED_BODY.map((seg, i) => (
              <ResolvedSegment key={i} text={seg} index={i} show={showResolved} />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
