"use client";

import { motion } from "framer-motion";
import { Cloud, FolderSync, Check } from "lucide-react";

const PROVIDERS = [
  { name: "Google Drive",  path: "/Clients/Smith/2026",     color: "#4285f4", delay: 0 },
  { name: "OneDrive",      path: "/Apps/Prompt/Smith",      color: "#0078d4", delay: 0.12 },
  { name: "Dropbox",       path: "/Apps/Prompt/Smith",      color: "#0061ff", delay: 0.24 },
];

export const CloudStorageSyncIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-3 py-2">
    <div className="w-full max-w-[200px]">

      {/* Sync header */}
      <motion.div
        className="flex items-center gap-1.5 mb-3"
        animate={{ opacity: isHovered ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      >
        <FolderSync size={11} className="text-sky-400" strokeWidth={2} />
        <span className="text-[8px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Auto-sync active
        </span>
      </motion.div>

      {/* Provider rows */}
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
              delay: p.delay,
            }}
          >
            {/* Provider icon */}
            <Cloud size={11} style={{ color: p.color }} strokeWidth={2} className="flex-shrink-0" />

            {/* Name + path */}
            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-bold text-foreground/70 block leading-none">
                {p.name}
              </span>
              <span className="text-[7px] text-muted-foreground/40 block leading-none mt-[2px] truncate">
                {p.path}
              </span>
            </div>

            {/* Synced check */}
            <motion.div
              animate={{
                opacity: isHovered ? 1 : 0,
                scale: isHovered ? 1 : 0.5,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 18,
                delay: p.delay + 0.3,
              }}
            >
              <Check size={10} className="text-emerald-500" strokeWidth={2.5} />
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Bottom note */}
      <motion.p
        className="text-[7px] text-muted-foreground/35 mt-2 px-1"
        animate={{ opacity: isHovered ? 0.6 : 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        Files never stored on our servers
      </motion.p>

    </div>
  </div>
);
