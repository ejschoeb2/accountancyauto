"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileCheck, ShieldCheck, File } from "lucide-react";

const CHECKLIST = [
  { label: "P60",              delay: 0.08 },
  { label: "Bank statements",  delay: 0.16 },
  { label: "Dividend vouchers", delay: 0.24 },
  { label: "Invoices",         delay: 0.32 },
];

/* Files that "arrive" into the drop zone on hover */
const DROPPING_FILES = [
  { name: "P60_2025.pdf",       delay: 0.6 },
  { name: "barclays_stmt.pdf",  delay: 1.1 },
];

export const ClientUploadPortalIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setChecked(new Set());
      /* Check items off one by one */
      const t0 = setTimeout(() => setChecked(new Set([0])), 900);
      const t1 = setTimeout(() => setChecked(new Set([0, 1])), 1400);
      timerRef.current = [t0, t1];
    } else {
      setChecked(new Set());
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex items-center justify-center px-4 py-3">
      <div className="w-full max-w-[240px] flex gap-4">

        {/* Left: upload zone + dropping files */}
        <div className="flex-1">
          {/* Upload zone */}
          <motion.div
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-violet-400/30 bg-violet-500/[0.03] px-3 py-4 mb-3"
            animate={{
              borderColor: isHovered ? "rgba(139,92,246,0.5)" : "rgba(139,92,246,0.2)",
            }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{ y: isHovered ? -3 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
            >
              <Upload size={16} className="text-violet-400" strokeWidth={1.5} />
            </motion.div>
            <span className="text-[8px] text-muted-foreground/50 font-medium">
              Drop files here
            </span>
          </motion.div>

          {/* Incoming files */}
          <div className="space-y-[4px]">
            {DROPPING_FILES.map((f, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-1.5 rounded-md bg-violet-500/[0.06] px-2 py-[4px]"
                initial={{ opacity: 0, y: -8, scale: 0.9 }}
                animate={{
                  opacity: isHovered ? 1 : 0,
                  y: isHovered ? 0 : -8,
                  scale: isHovered ? 1 : 0.9,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 18,
                  delay: f.delay,
                }}
              >
                <File size={9} className="text-violet-400 flex-shrink-0" strokeWidth={2} />
                <span className="text-[7px] text-violet-400/80 font-medium truncate">
                  {f.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: checklist */}
        <div className="w-[90px] flex-shrink-0">
          <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider block mb-2">
            Required
          </span>
          <div className="space-y-[6px]">
            {CHECKLIST.map((item, i) => {
              const isDone = checked.has(i);
              return (
                <motion.div
                  key={i}
                  className="flex items-center gap-1.5"
                  animate={{
                    opacity: isHovered ? 1 : 0.4,
                    x: isHovered ? 0 : -4,
                  }}
                  transition={{ duration: 0.2, delay: item.delay }}
                >
                  <motion.div
                    className="w-[12px] h-[12px] rounded-sm border flex items-center justify-center flex-shrink-0"
                    animate={{
                      borderColor: isDone ? "#8b5cf6" : "rgba(139,92,246,0.3)",
                      backgroundColor: isDone ? "rgba(139,92,246,0.15)" : "transparent",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {isDone && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 14 }}
                      >
                        <FileCheck size={8} className="text-violet-500" strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </motion.div>
                  <span className={`text-[8px] leading-none ${isDone ? "text-violet-400 line-through" : "text-muted-foreground/50"}`}>
                    {item.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Secure badge */}
          <motion.div
            className="flex items-center gap-1 mt-3"
            animate={{ opacity: isHovered ? 0.7 : 0 }}
            transition={{ duration: 0.2, delay: 0.45 }}
          >
            <ShieldCheck size={8} className="text-emerald-500" strokeWidth={2} />
            <span className="text-[7px] text-emerald-500/80 font-medium">No login required</span>
          </motion.div>
        </div>

      </div>
    </div>
  );
};
