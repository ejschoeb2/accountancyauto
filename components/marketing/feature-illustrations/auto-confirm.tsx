"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleCheck, Loader2 } from "lucide-react";

const CLIENTS = [
  { name: "J. Smith Ltd",   doc: "P60",            delay: 0.5 },
  { name: "Taylor Group",   doc: "Bank statements", delay: 1.0 },
  { name: "Webb & Co",      doc: "VAT receipts",    delay: 1.5 },
];

type Status = "pending" | "scanning" | "confirmed";

export const AutoConfirmIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [statuses, setStatuses] = useState<Status[]>(CLIENTS.map(() => "pending"));
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setStatuses(CLIENTS.map(() => "pending"));

      CLIENTS.forEach((c, i) => {
        const t1 = setTimeout(() => {
          setStatuses(prev => {
            const next = [...prev];
            next[i] = "scanning";
            return next;
          });
        }, c.delay * 1000);

        const t2 = setTimeout(() => {
          setStatuses(prev => {
            const next = [...prev];
            next[i] = "confirmed";
            return next;
          });
        }, (c.delay + 0.6) * 1000);

        timerRef.current.push(t1, t2);
      });
    } else {
      setStatuses(CLIENTS.map(() => "pending"));
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex items-center justify-center px-3 py-2">
      <div className="w-full max-w-[210px]">

        {/* Header */}
        <motion.div
          className="flex items-center gap-1.5 mb-3"
          animate={{ opacity: isHovered ? 1 : 0.35 }}
          transition={{ duration: 0.3 }}
        >
          <CircleCheck size={11} className="text-emerald-400" strokeWidth={2} />
          <span className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
            Auto-confirmed
          </span>
        </motion.div>

        {/* Client rows */}
        <div className="flex flex-col gap-[6px]">
          {CLIENTS.map((client, i) => {
            const status = statuses[i];
            return (
              <motion.div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-card/60 px-2.5 py-[7px] shadow-sm"
                animate={{
                  opacity: isHovered ? 1 : 0.5,
                  x: isHovered ? 0 : -3,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: i * 0.06,
                }}
              >
                {/* Client + doc info */}
                <div className="flex-1 min-w-0">
                  <span className="text-[8px] font-bold text-foreground/70 block leading-none">
                    {client.name}
                  </span>
                  <span className="text-[7px] text-muted-foreground/40 block leading-none mt-[2px]">
                    {client.doc}
                  </span>
                </div>

                {/* Status badge */}
                <div className="relative h-[16px] w-[68px] flex-shrink-0">
                  <AnimatePresence mode="wait">
                    {status === "pending" && (
                      <motion.span
                        key="pending"
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-muted-foreground/10 text-[7px] font-semibold text-muted-foreground/40"
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        Pending
                      </motion.span>
                    )}
                    {status === "scanning" && (
                      <motion.span
                        key="scanning"
                        className="absolute inset-0 flex items-center justify-center gap-1 rounded-full bg-sky-500/10 text-[7px] font-semibold text-sky-500"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 size={8} strokeWidth={2.5} />
                        </motion.div>
                        Scanning
                      </motion.span>
                    )}
                    {status === "confirmed" && (
                      <motion.span
                        key="confirmed"
                        className="absolute inset-0 flex items-center justify-center gap-[3px] rounded-full bg-emerald-500/15 text-[7px] font-bold text-emerald-500"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 18 }}
                      >
                        <CircleCheck size={8} strokeWidth={2.5} />
                        Confirmed
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
