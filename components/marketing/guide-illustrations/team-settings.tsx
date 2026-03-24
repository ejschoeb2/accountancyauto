"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Shield, User } from "lucide-react";

interface TeamMember {
  initials: string;
  name: string;
  email: string;
  role: "Admin" | "Member";
  color: string;
  bg: string;
}

const MEMBERS: TeamMember[] = [
  { initials: "SC", name: "Sarah Chen",     email: "sarah@practice.co.uk",   role: "Admin",  color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { initials: "JP", name: "James Patel",    email: "james@practice.co.uk",   role: "Admin",  color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { initials: "LW", name: "Lucy Williams",  email: "lucy@practice.co.uk",    role: "Member", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { initials: "TK", name: "Tom Kelly",      email: "tom@practice.co.uk",     role: "Member", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
];

const NEW_INVITE: TeamMember = {
  initials: "RH",
  name: "Rachel Hughes",
  email: "rachel@practice.co.uk",
  role: "Member",
  color: "#3b82f6",
  bg: "rgba(59,130,246,0.12)",
};

const ROLE_STYLES = {
  Admin:  { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", Icon: Shield },
  Member: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  Icon: User },
};

export const TeamSettingsIllustration = ({ isHovered }: { isHovered: boolean }) => {
  const [showInvite, setShowInvite] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isHovered) {
      setShowInvite(false);
      timerRef.current = setTimeout(() => setShowInvite(true), 1000);
    } else {
      setShowInvite(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered]);

  const allMembers = showInvite ? [...MEMBERS, NEW_INVITE] : MEMBERS;

  return (
    <div className="w-full h-full flex flex-col justify-center px-5 py-3 select-none overflow-hidden">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-2.5"
        animate={{ opacity: isHovered ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
          Team
        </span>
        <motion.div
          className="flex items-center gap-1 px-2 py-[3px] rounded-md bg-violet-500/10"
          animate={{
            opacity: isHovered ? 1 : 0,
            scale: isHovered ? 1 : 0.9,
          }}
          transition={{ duration: 0.2, delay: 0.2 }}
        >
          <UserPlus size={8} className="text-violet-500" strokeWidth={2.5} />
          <span className="text-[7px] font-semibold text-violet-500">
            Invite
          </span>
        </motion.div>
      </motion.div>

      {/* Member rows */}
      <div className="flex flex-col gap-[5px]">
        {allMembers.map((member, i) => {
          const roleStyle = ROLE_STYLES[member.role];
          const RoleIcon = roleStyle.Icon;
          const isNew = showInvite && i === allMembers.length - 1;

          return (
            <motion.div
              key={member.email}
              className="flex items-center gap-2 rounded-lg px-2 py-[5px]"
              initial={isNew ? { opacity: 0, y: 10, height: 0 } : false}
              animate={{
                opacity: isHovered ? 1 : 0.35,
                x: isHovered ? 0 : -4,
                y: 0,
                height: "auto",
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: isNew ? 0 : i * 0.05,
              }}
            >
              {/* Avatar */}
              <motion.div
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 text-[7px] font-bold text-white"
                style={{ backgroundColor: member.color }}
                animate={{
                  scale: isNew ? [0.7, 1] : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                {member.initials}
              </motion.div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-semibold text-foreground/70 block leading-none">
                  {member.name}
                </span>
                <span className="text-[7px] text-muted-foreground/40 block leading-none mt-[2px] truncate">
                  {member.email}
                </span>
              </div>

              {/* Role badge */}
              <motion.span
                className="inline-flex items-center gap-[3px] text-[7px] font-semibold px-2 py-[3px] rounded-full flex-shrink-0"
                style={{
                  backgroundColor: roleStyle.bg,
                  color: roleStyle.color,
                }}
                animate={{
                  scale: isNew ? [0.8, 1] : 1,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 18 }}
              >
                <RoleIcon size={7} strokeWidth={2.5} />
                {member.role}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
