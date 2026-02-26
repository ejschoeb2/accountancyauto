"use client";

import { motion } from "framer-motion";

const hidden = { opacity: 0, y: 8 };
const visible = { opacity: 1, y: 0 };

const ClientRow = ({
  name,
  yearEnd,
  vatGroup,
  baseDelay,
  isActive,
}: {
  name: string;
  yearEnd: string;
  vatGroup: string;
  baseDelay: number;
  isActive: boolean;
}) => (
  <motion.div
    initial={hidden}
    animate={isActive ? visible : hidden}
    transition={{ duration: 0.35, delay: baseDelay, ease: "easeOut" }}
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40"
  >
    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="overflow-hidden mb-1">
        <motion.p
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={isActive ? { clipPath: "inset(0 0% 0 0)" } : { clipPath: "inset(0 100% 0 0)" }}
          transition={{ duration: 0.5, delay: baseDelay + 0.2, ease: "easeOut" }}
          className="text-[12px] font-semibold text-foreground whitespace-nowrap"
        >
          {name}
        </motion.p>
      </div>
      <div className="flex items-center gap-2">
        <motion.span
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.2, delay: baseDelay + 0.75 }}
          className="text-[10px] text-muted-foreground"
        >
          Year end: {yearEnd}
        </motion.span>
        <motion.span
          initial={{ opacity: 0, scale: 0.85 }}
          animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.2, delay: baseDelay + 0.95, ease: "backOut" }}
          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500"
        >
          {vatGroup}
        </motion.span>
      </div>
    </div>
  </motion.div>
);

export const AddClientsIllustration: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <div className="w-full h-full flex flex-col justify-center gap-2.5">
    <ClientRow
      name="Meridian Ltd"
      yearEnd="31 Mar"
      vatGroup="VAT Group 1"
      baseDelay={0.1}
      isActive={isActive}
    />
    <ClientRow
      name="Thornton & Co"
      yearEnd="5 Apr"
      vatGroup="VAT Group 2"
      baseDelay={0.8}
      isActive={isActive}
    />
  </div>
);
