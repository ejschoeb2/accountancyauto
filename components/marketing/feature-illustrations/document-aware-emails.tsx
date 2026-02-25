"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const ITEMS = [
  { label: "Bank statements",   checked: true,  delay: 0.12 },
  { label: "P60 / P11D",        checked: true,  delay: 0.22 },
  { label: "Dividend vouchers", checked: false, delay: 0.35 },
];

export const DocumentAwareEmailsIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-4 py-2">
    <div className="w-full max-w-[160px] rounded-xl border border-indigo-500/25 bg-indigo-500/[0.04] overflow-hidden">

      {/* Email header chrome */}
      <div className="px-3 pt-2.5 pb-2 border-b border-indigo-500/15">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-3 h-3 rounded-full bg-indigo-400/25 flex-shrink-0" />
          <div className="h-[4px] rounded-full bg-foreground/[0.08] w-16" />
        </div>
        <div className="h-[3.5px] rounded-full bg-foreground/[0.06] w-24" />
      </div>

      {/* Checklist */}
      <div className="px-3 py-2.5 space-y-[8px]">
        {ITEMS.map((item, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -6 }}
            transition={{ duration: 0.2, delay: item.delay }}
          >
            {/* Checkbox */}
            <div className={`
              relative w-3.5 h-3.5 rounded-[3px] border flex-shrink-0 flex items-center justify-center
              ${item.checked ? "bg-indigo-500 border-indigo-500" : "border-indigo-400/35 bg-transparent"}
            `}>
              {item.checked && (
                <Check size={7} strokeWidth={3.5} className="text-white" />
              )}

              {/* Third item: check springs in */}
              {!item.checked && (
                <motion.div
                  className="absolute inset-0 rounded-[3px] bg-indigo-500 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: isHovered ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 13, delay: 0.68 }}
                >
                  <Check size={7} strokeWidth={3.5} className="text-white" />
                </motion.div>
              )}
            </div>

            <span className="text-[8px] text-muted-foreground/55 leading-none truncate">
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);
