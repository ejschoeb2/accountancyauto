"use client";

import { motion } from "framer-motion";
import { FileText, Check, Upload } from "lucide-react";

const docs = [
  { name: "Bank Statements",   uploaded: true },
  { name: "Receipts",          uploaded: true },
  { name: "Payroll Records",   uploaded: false },
  { name: "VAT Invoices",      uploaded: false },
];

export const UploadPortalIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-6 select-none">
    <div className="w-full max-w-xs">
      {/* Upload zone header */}
      <motion.div
        className="flex items-center justify-center gap-1.5 mb-2"
        animate={{ opacity: isHovered ? 0.5 : 0.2 }}
        transition={{ duration: 0.2 }}
      >
        <Upload size={10} className="text-muted-foreground" />
        <span className="text-[7px] text-muted-foreground uppercase tracking-wider font-semibold">
          Document Checklist
        </span>
      </motion.div>

      {/* Document checklist */}
      <div className="space-y-1">
        {docs.map((doc, i) => (
          <motion.div
            key={doc.name}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/40"
            initial={{ opacity: 0.3 }}
            animate={{
              opacity: isHovered ? 1 : 0.3,
              borderColor: isHovered && doc.uploaded ? "rgba(16,185,129,0.3)" : "rgba(0,0,0,0.06)",
              backgroundColor: isHovered && doc.uploaded ? "rgba(16,185,129,0.04)" : "transparent",
            }}
            transition={{ delay: i * 0.08, duration: 0.25 }}
          >
            {/* File icon */}
            <FileText size={11} className="text-muted-foreground/50 shrink-0" />

            {/* Name */}
            <span className="text-[9px] text-foreground/70 flex-1">{doc.name}</span>

            {/* Status */}
            <motion.div
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: doc.uploaded ? "rgba(16,185,129,0.15)" : "rgba(0,0,0,0.04)",
              }}
              animate={{ scale: isHovered ? 1 : 0.6 }}
              transition={{ type: "spring", stiffness: 350, damping: 16, delay: i * 0.08 + 0.12 }}
            >
              {doc.uploaded ? (
                <Check size={9} className="text-emerald-600" />
              ) : (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20"
                  animate={isHovered ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              )}
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);
