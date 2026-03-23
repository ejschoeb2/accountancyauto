"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AtSign, Check, Globe } from "lucide-react";

const DNS_RECORDS = [
  { type: "DKIM",        status: "Verified", delay: 0.4 },
  { type: "Return-Path", status: "Verified", delay: 0.6 },
  { type: "SPF",         status: "Verified", delay: 0.8 },
];

export const CustomDomainsIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [dnsRevealed, setDnsRevealed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (isHovered) {
      setDnsRevealed(0);
      DNS_RECORDS.forEach((r, i) => {
        const t = setTimeout(() => setDnsRevealed(i + 1), r.delay * 1000);
        timerRef.current.push(t);
      });
    } else {
      setDnsRevealed(0);
    }

    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [isHovered]);

  return (
    <div className="w-full h-full flex items-center justify-center px-3 py-2">
      <div className="w-full max-w-[190px]">

        {/* From field */}
        <div className="rounded-lg border border-white/[0.06] bg-card/60 px-2.5 py-2 shadow-sm mb-3">
          <span className="text-[7px] font-semibold text-muted-foreground/40 uppercase tracking-wider block mb-1">
            From
          </span>
          <div className="relative h-[14px]">
            <AnimatePresence mode="wait">
              {!isHovered ? (
                <motion.div
                  key="generic"
                  className="absolute inset-0 flex items-center gap-1"
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <AtSign size={9} className="text-muted-foreground/30" strokeWidth={2} />
                  <span className="text-[9px] text-muted-foreground/40">
                    noreply@prompt.so
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="custom"
                  className="absolute inset-0 flex items-center gap-1"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                >
                  <Globe size={9} className="text-indigo-400" strokeWidth={2} />
                  <span className="text-[9px] font-semibold text-indigo-400">
                    reminders@smith.co.uk
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* DNS records */}
        <motion.div
          animate={{ opacity: isHovered ? 1 : 0.3 }}
          transition={{ duration: 0.3 }}
        >
          <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider block mb-1.5 px-1">
            DNS Records
          </span>
          <div className="space-y-[4px]">
            {DNS_RECORDS.map((r, i) => (
              <motion.div
                key={i}
                className="flex items-center justify-between px-2 py-[4px] rounded-md bg-card/40"
                animate={{
                  opacity: isHovered ? 1 : 0.4,
                  x: isHovered ? 0 : -3,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: i * 0.06,
                }}
              >
                <span className="text-[8px] font-bold text-foreground/55">
                  {r.type}
                </span>
                <motion.div
                  className="flex items-center gap-[3px]"
                  animate={{
                    opacity: i < dnsRevealed ? 1 : 0,
                    scale: i < dnsRevealed ? 1 : 0.5,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 18,
                  }}
                >
                  <Check size={8} className="text-emerald-500" strokeWidth={2.5} />
                  <span className="text-[7px] font-semibold text-emerald-500">
                    {r.status}
                  </span>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
};
