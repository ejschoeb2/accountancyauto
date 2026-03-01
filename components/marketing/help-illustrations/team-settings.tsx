"use client";

import { motion } from "framer-motion";
import { Shield, User } from "lucide-react";

const members = [
  { initials: "JS", name: "Jane Smith",    role: "Admin",  color: "#8b5cf6", isAdmin: true  },
  { initials: "MR", name: "Mark Roberts",  role: "Member", color: "#3b82f6", isAdmin: false },
  { initials: "PK", name: "Priya Kumar",   role: "Member", color: "#10b981", isAdmin: false },
];

export const TeamSettingsIllustration = ({ isHovered }: { isHovered: boolean }) => (
  <div className="w-full h-full flex items-center justify-center px-6 select-none">
    <div className="flex items-center gap-4">
      {members.map((m, i) => (
        <motion.div
          key={m.name}
          className="flex flex-col items-center gap-1.5"
          initial={{ opacity: 0.3, scale: 0.9 }}
          animate={{
            opacity: isHovered ? 1 : 0.3,
            scale: isHovered ? 1 : 0.9,
          }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
        >
          {/* Avatar */}
          <motion.div
            className="relative w-11 h-11 rounded-full flex items-center justify-center border-2"
            style={{ borderColor: m.color, backgroundColor: `${m.color}12` }}
            animate={{
              borderColor: isHovered ? m.color : "rgba(0,0,0,0.1)",
            }}
            transition={{ delay: i * 0.1 }}
          >
            <span
              className="text-[11px] font-bold"
              style={{ color: m.color }}
            >
              {m.initials}
            </span>

            {/* Role badge */}
            <motion.div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: m.isAdmin ? "#8b5cf6" : "#64748b" }}
              animate={{ scale: isHovered ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 14, delay: i * 0.1 + 0.15 }}
            >
              {m.isAdmin ? (
                <Shield size={8} className="text-white" />
              ) : (
                <User size={8} className="text-white" />
              )}
            </motion.div>
          </motion.div>

          {/* Name */}
          <motion.span
            className="text-[8px] font-medium text-foreground/70 text-center leading-tight"
            animate={{ opacity: isHovered ? 1 : 0.4 }}
            transition={{ delay: i * 0.1 + 0.1 }}
          >
            {m.name}
          </motion.span>

          {/* Role label */}
          <motion.span
            className="text-[7px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{
              color: m.isAdmin ? "#8b5cf6" : "#64748b",
              backgroundColor: m.isAdmin ? "rgba(139,92,246,0.1)" : "rgba(100,116,139,0.1)",
            }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ delay: i * 0.1 + 0.2 }}
          >
            {m.role}
          </motion.span>
        </motion.div>
      ))}
    </div>
  </div>
);
