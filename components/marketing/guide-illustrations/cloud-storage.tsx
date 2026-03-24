"use client";

import { motion } from "framer-motion";
import { Cloud, FolderSync, Check, Database } from "lucide-react";

const PROVIDERS = [
  { name: "Google Drive",  path: "/Clients/Smith/2026",  color: "#4285f4", delay: 0 },
  { name: "OneDrive",      path: "/Apps/Prompt/Smith",   color: "#0078d4", delay: 0.12 },
  { name: "Dropbox",       path: "/Apps/Prompt/Smith",   color: "#0061ff", delay: 0.24 },
];

export const CloudStorageIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-5 py-4 select-none overflow-hidden">
    <div className="w-full max-w-[220px]">
      {/* Header */}
      <motion.div
        className="flex items-center gap-1.5 mb-3"
        animate={{ opacity: isHovered ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      >
        <FolderSync size={11} className="text-sky-400" strokeWidth={2} />
        <span className="text-[8px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Document Storage
        </span>
      </motion.div>

      {/* Default storage */}
      <motion.div
        className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-2.5 py-[7px] mb-2"
        animate={{
          opacity: isHovered ? 1 : 0.5,
          x: isHovered ? 0 : -3,
        }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
      >
        <Database size={10} className="text-emerald-500 flex-shrink-0" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <span className="text-[8px] font-bold text-foreground/70 block leading-none">
            Supabase Storage
          </span>
          <span className="text-[7px] text-muted-foreground/40 block leading-none mt-[2px]">
            Default — always active
          </span>
        </div>
        <Check size={10} className="text-emerald-500 flex-shrink-0" strokeWidth={2.5} />
      </motion.div>

      {/* Divider */}
      <motion.div
        className="flex items-center gap-2 mb-2"
        animate={{ opacity: isHovered ? 0.5 : 0.2 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex-1 h-px bg-border/30" />
        <span className="text-[7px] text-muted-foreground/35 font-medium">
          Sync to
        </span>
        <div className="flex-1 h-px bg-border/30" />
      </motion.div>

      {/* Cloud providers */}
      <div className="space-y-[6px]">
        {PROVIDERS.map((p, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-card/60 px-2.5 py-[7px]"
            animate={{
              opacity: isHovered ? 1 : 0.5,
              x: isHovered ? 0 : -3,
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: p.delay + 0.15,
            }}
          >
            <Cloud size={11} style={{ color: p.color }} strokeWidth={2} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-bold text-foreground/70 block leading-none">
                {p.name}
              </span>
              <span className="text-[7px] text-muted-foreground/40 block leading-none mt-[2px] truncate">
                {p.path}
              </span>
            </div>
            <motion.div
              animate={{
                opacity: isHovered ? 1 : 0,
                scale: isHovered ? 1 : 0.5,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 18,
                delay: p.delay + 0.45,
              }}
            >
              <Check size={10} className="text-emerald-500" strokeWidth={2.5} />
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Footer note */}
      <motion.p
        className="text-[7px] text-muted-foreground/35 mt-2 px-1"
        animate={{ opacity: isHovered ? 0.6 : 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
      >
        Write-only — never deletes your files
      </motion.p>
    </div>
  </div>
);
