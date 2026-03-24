"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Hash, Calendar, Layers, Mail, Activity } from "lucide-react";

interface FieldRow {
  icon: typeof Building2;
  label: string;
  value: string;
  color: string;
  bg: string;
  tooltip: string;
}

const FIELDS: FieldRow[] = [
  {
    icon: Building2,
    label: "Company Name",
    value: "J. Smith Ltd",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
    tooltip: "Used in emails and portal pages",
  },
  {
    icon: Hash,
    label: "Company Number",
    value: "12345678",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    tooltip: "Links to Companies House filings",
  },
  {
    icon: Calendar,
    label: "Year-End Date",
    value: "31 Mar 2025",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    tooltip: "All deadlines calculated from this",
  },
  {
    icon: Layers,
    label: "VAT Stagger Group",
    value: "Group 1",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    tooltip: "Determines VAT quarter dates",
  },
  {
    icon: Mail,
    label: "Email Address",
    value: "john@smithltd.co.uk",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.08)",
    tooltip: "Where reminders are sent",
  },
  {
    icon: Activity,
    label: "Status",
    value: "Active",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    tooltip: "Controls reminder pipeline",
  },
];

const HIGHLIGHT_ROW = 2; // Year-End Date — most important field

export const ClientFieldsIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [highlightedRow, setHighlightedRow] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isHovered) {
      setHighlightedRow(-1);
      timerRef.current = setTimeout(() => setHighlightedRow(HIGHLIGHT_ROW), 700);
    } else {
      setHighlightedRow(-1);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex flex-col justify-center px-5 py-3 select-none overflow-hidden">
      <div className="flex flex-col gap-[5px]">
        {FIELDS.map((field, i) => {
          const Icon = field.icon;
          const isHighlighted = i === highlightedRow;

          return (
            <motion.div
              key={field.label}
              className="flex items-center gap-2 rounded-lg px-2.5 py-[6px] relative"
              style={{
                backgroundColor: isHighlighted ? field.bg : undefined,
              }}
              animate={{
                opacity: isHovered ? 1 : 0.3 + i * 0.08,
                x: isHovered ? 0 : -5,
              }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 20,
                delay: i * 0.05,
              }}
            >
              {/* Icon */}
              <Icon
                size={11}
                strokeWidth={2}
                style={{ color: field.color }}
                className="flex-shrink-0"
              />

              {/* Label */}
              <span className="text-[9px] text-muted-foreground/50 w-[90px] flex-shrink-0">
                {field.label}
              </span>

              {/* Value pill */}
              <motion.span
                className="text-[9px] font-semibold px-2 py-[2px] rounded-full"
                style={{ backgroundColor: field.bg, color: field.color }}
                animate={{
                  scale: isHighlighted ? 1.05 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
              >
                {field.value}
              </motion.span>

              {/* Tooltip */}
              <AnimatePresence>
                {isHighlighted && (
                  <motion.div
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-foreground text-background text-[7px] font-medium px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-10"
                    initial={{ opacity: 0, x: -6, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -6, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 350, damping: 20 }}
                  >
                    {field.tooltip}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
