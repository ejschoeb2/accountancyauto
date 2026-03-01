"use client";

import { motion } from "framer-motion";

const clients = [
  { name: "Acme Ltd",        yearEnd: "31 Mar", status: "#3b82f6", vat: "Group 1" },
  { name: "Baker & Sons",    yearEnd: "30 Jun", status: "#f59e0b", vat: "Group 2" },
  { name: "Clarke Trading",  yearEnd: "31 Dec", status: "#10b981", vat: "Group 3" },
  { name: "Davidson Corp",   yearEnd: "30 Sep", status: "#ef4444", vat: "Group 1" },
];

export const ManagingClientsIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-4 select-none">
    <div className="w-full max-w-sm">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_60px_60px_16px] gap-2 mb-1.5 px-2">
        {["Client", "Year End", "VAT", ""].map((h) => (
          <span key={h} className="text-[7px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
            {h}
          </span>
        ))}
      </div>

      {/* Client rows */}
      {clients.map((c, i) => (
        <motion.div
          key={c.name}
          className="grid grid-cols-[1fr_60px_60px_16px] gap-2 items-center px-2 py-1.5 rounded-md"
          initial={{ opacity: 0, x: -12 }}
          animate={{
            opacity: isHovered ? 1 : 0.35,
            x: isHovered ? 0 : -12,
            backgroundColor: isHovered && i === 1 ? "rgba(139,92,246,0.06)" : "transparent",
          }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
        >
          <span className="text-[10px] font-medium text-foreground truncate">{c.name}</span>
          <span className="text-[9px] text-muted-foreground tabular-nums">{c.yearEnd}</span>
          <span className="text-[8px] text-muted-foreground">{c.vat}</span>
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: c.status }}
            animate={{ scale: isHovered ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 14, delay: i * 0.08 + 0.15 }}
          />
        </motion.div>
      ))}
    </div>
  </div>
);
