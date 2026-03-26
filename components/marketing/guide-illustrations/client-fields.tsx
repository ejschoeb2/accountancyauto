"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FieldRow {
  label: string;
  value: string;
  color: string;
  bg: string;
}

const FIELDS: FieldRow[] = [
  {
    label: "Company Name",
    value: "J. Smith Ltd",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
  },
  {
    label: "Company Number",
    value: "12345678",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
  },
  {
    label: "Year-End Date",
    value: "31 Mar 2025",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
  },
  {
    label: "VAT Stagger Group",
    value: "Group 1",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
  },
  {
    label: "Email Address",
    value: "john@smithltd.co.uk",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.08)",
  },
  {
    label: "Status",
    value: "Active",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
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
              {/* Label */}
              <span className="text-[10px] text-muted-foreground/50 w-[100px] flex-shrink-0">
                {field.label}
              </span>

              {/* Value pill */}
              <motion.span
                className="text-[10px] font-semibold px-2 py-[2px] rounded-full"
                style={{ backgroundColor: field.bg, color: field.color }}
                animate={{
                  scale: isHighlighted ? 1.08 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
              >
                {field.value}
              </motion.span>

              {/* Highlight callout for Year-End Date */}
              <AnimatePresence>
                {isHighlighted && (
                  <motion.div
                    className="absolute -right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10"
                    initial={{ opacity: 0, x: -8, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -8, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 350, damping: 20 }}
                  >
                    <motion.div
                      className="w-4 border-t border-dashed"
                      style={{ borderColor: field.color }}
                      initial={{ width: 0 }}
                      animate={{ width: 16 }}
                      transition={{ duration: 0.2 }}
                    />
                    <span
                      className="text-[8px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap"
                      style={{ backgroundColor: field.bg, color: field.color }}
                    >
                      All deadlines calculated from this
                    </span>
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
