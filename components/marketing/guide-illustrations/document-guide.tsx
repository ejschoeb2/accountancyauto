"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Receipt,
  Building2,
  Calculator,
  Percent,
  CreditCard,
} from "lucide-react";

interface DocType {
  icon: typeof FileText;
  label: string;
  accent: string;
  bg: string;
}

const DOCS: DocType[] = [
  { icon: FileText,   label: "P60",              accent: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
  { icon: Receipt,    label: "Bank Statement",   accent: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  { icon: Building2,  label: "SA302",            accent: "#10b981", bg: "rgba(16,185,129,0.08)" },
  { icon: Calculator, label: "Tax Computation",  accent: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  { icon: Percent,    label: "VAT Return",       accent: "#f97316", bg: "rgba(249,115,22,0.08)" },
  { icon: CreditCard, label: "Dividend Voucher", accent: "#0ea5e9", bg: "rgba(14,165,233,0.08)" },
];

export const DocumentGuideIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex flex-col items-center justify-center px-5 py-4 select-none overflow-hidden">
    {/* 3×2 grid */}
    <div className="grid grid-cols-3 gap-2 w-full max-w-[230px]">
      {DOCS.map((doc, i) => {
        const Icon = doc.icon;
        return (
          <motion.div
            key={i}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-white/[0.06] px-2 py-2.5 relative overflow-hidden"
            style={{ backgroundColor: doc.bg }}
            animate={{
              opacity: isHovered ? 1 : 0.4,
              y: isHovered ? 0 : 8,
            }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 18,
              delay: i * 0.06,
            }}
          >
            {/* Left accent bar */}
            <motion.div
              className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
              style={{ backgroundColor: doc.accent }}
              animate={{
                scaleY: isHovered ? 1 : 0.3,
                opacity: isHovered ? 0.8 : 0.3,
              }}
              transition={{ duration: 0.25, delay: i * 0.06 }}
            />

            <Icon
              size={16}
              strokeWidth={1.5}
              style={{ color: doc.accent }}
            />
            <span
              className="text-[7.5px] font-semibold text-center leading-tight"
              style={{ color: doc.accent }}
            >
              {doc.label}
            </span>
          </motion.div>
        );
      })}
    </div>

    {/* "View all" link */}
    <motion.span
      className="text-[8px] font-semibold text-violet-500 mt-3"
      animate={{ opacity: isHovered ? 0.7 : 0 }}
      transition={{ duration: 0.2, delay: 0.4 }}
    >
      View all document types →
    </motion.span>
  </div>
);
