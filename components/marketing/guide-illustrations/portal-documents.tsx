"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck, Circle, Check, Settings2, FileText } from "lucide-react";

interface ChecklistItem {
  label: string;
  status: "received" | "pending" | "custom";
}

const ITEMS: ChecklistItem[] = [
  { label: "P60 — 2025/26",         status: "received" },
  { label: "Bank statements (all)",  status: "received" },
  { label: "Dividend vouchers",      status: "pending" },
  { label: "Property income records", status: "pending" },
  { label: "Gift Aid receipts",      status: "custom" },
];

/* Item index 2 (Dividend vouchers) animates to received on hover */
const ANIMATE_ITEM = 2;

export const PortalDocumentsIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [animatedReceived, setAnimatedReceived] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isHovered) {
      setAnimatedReceived(false);
      timerRef.current = setTimeout(() => setAnimatedReceived(true), 900);
    } else {
      setAnimatedReceived(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex flex-col justify-center px-5 py-3 select-none overflow-hidden">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-2.5"
        animate={{ opacity: isHovered ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-1.5">
          <FileText size={10} className="text-violet-500" strokeWidth={2} />
          <span className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
            Document Checklist
          </span>
        </div>
        <motion.div
          className="flex items-center gap-1 px-1.5 py-[2px] rounded bg-muted/60"
          animate={{ opacity: isHovered ? 0.7 : 0 }}
          transition={{ duration: 0.2, delay: 0.3 }}
        >
          <Settings2 size={7} className="text-muted-foreground/50" strokeWidth={2} />
          <span className="text-[7px] text-muted-foreground/50 font-medium">
            Customise
          </span>
        </motion.div>
      </motion.div>

      {/* Checklist */}
      <div className="flex flex-col gap-[5px]">
        {ITEMS.map((item, i) => {
          const isAnimItem = i === ANIMATE_ITEM;
          const isReceived =
            item.status === "received" || (isAnimItem && animatedReceived);
          const isCustom = item.status === "custom";

          return (
            <motion.div
              key={i}
              className="flex items-center gap-2 rounded-lg px-2.5 py-[6px]"
              style={{
                backgroundColor:
                  isAnimItem && animatedReceived
                    ? "rgba(34,197,94,0.06)"
                    : undefined,
              }}
              animate={{
                opacity: isHovered ? 1 : 0.35,
                x: isHovered ? 0 : -4,
              }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 20,
                delay: i * 0.05,
              }}
            >
              {/* Checkbox */}
              <motion.div
                className="w-[14px] h-[14px] rounded-sm border-2 flex items-center justify-center flex-shrink-0"
                animate={{
                  borderColor: isReceived
                    ? "#22c55e"
                    : "rgba(156,163,175,0.3)",
                  backgroundColor: isReceived
                    ? "rgba(34,197,94,0.12)"
                    : "transparent",
                }}
                transition={{ duration: 0.2 }}
              >
                <AnimatePresence>
                  {isReceived && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 14,
                      }}
                    >
                      <Check
                        size={9}
                        className="text-emerald-500"
                        strokeWidth={3}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Label */}
              <span
                className={`text-[9px] flex-1 leading-none ${
                  isReceived
                    ? "text-emerald-600/60 line-through"
                    : "text-muted-foreground/60"
                }`}
              >
                {item.label}
              </span>

              {/* Status / custom badge */}
              {isReceived ? (
                <motion.span
                  className="text-[7px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-[2px] rounded-full"
                  initial={isAnimItem ? { opacity: 0, scale: 0.7 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 18,
                  }}
                >
                  Received
                </motion.span>
              ) : isCustom ? (
                <motion.span
                  className="text-[7px] font-semibold text-violet-500 bg-violet-500/10 px-1.5 py-[2px] rounded-full"
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: 0.35 }}
                >
                  Custom
                </motion.span>
              ) : (
                <span className="text-[7px] text-muted-foreground/30 font-medium">
                  Pending
                </span>
              )}

              {/* Mini file thumbnail for received items */}
              {isReceived && !isAnimItem && (
                <motion.div
                  className="w-[14px] h-[16px] rounded-sm bg-muted/60 border border-border/30 flex items-center justify-center"
                  animate={{ opacity: isHovered ? 0.6 : 0 }}
                  transition={{ duration: 0.2, delay: 0.2 }}
                >
                  <FileCheck size={7} className="text-muted-foreground/40" strokeWidth={2} />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
