import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import {
  Background,
  AnimatedHeading,
  SpringIn,
  Card,
  SceneLabel,
  Badge,
} from "../../components/shared";
import { colors, fonts } from "../../components/theme";

type ClientRow = {
  name: string;
  filing: string;
  deadline: string;
  status: "red" | "orange" | "amber" | "blue" | "green";
  statusLabel: string;
};

const clients: ClientRow[] = [
  {
    name: "Bright Solutions Ltd",
    filing: "CT600",
    deadline: "22 Mar 2026",
    status: "red",
    statusLabel: "Overdue",
  },
  {
    name: "Oak & Partners",
    filing: "VAT Return",
    deadline: "07 Apr 2026",
    status: "orange",
    statusLabel: "7 days left",
  },
  {
    name: "Elm Street Consulting",
    filing: "Corp Tax",
    deadline: "15 May 2026",
    status: "amber",
    statusLabel: "56 days",
  },
  {
    name: "River Logistics",
    filing: "Companies House",
    deadline: "30 Jun 2026",
    status: "blue",
    statusLabel: "On track",
  },
  {
    name: "Summit Digital",
    filing: "Self Assessment",
    deadline: "31 Jan 2027",
    status: "green",
    statusLabel: "Complete",
  },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  red: { bg: `${colors.red}18`, text: colors.red },
  orange: { bg: `${colors.orange}18`, text: colors.orange },
  amber: { bg: `${colors.amber}18`, text: colors.amber },
  blue: { bg: `${colors.blue}18`, text: colors.blue },
  green: { bg: `${colors.green}18`, text: colors.green },
};

export const DeadlineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Background>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "60px 80px",
            height: "100%",
            gap: 32,
          }}
        >
          {/* Header */}
          <SceneLabel text="Deadline Tracking" delay={0} />
          <AnimatedHeading
            text="Every deadline, at a glance"
            fontSize={56}
            delay={5}
          />

          <SpringIn delay={12}>
            <p
              style={{
                fontSize: 22,
                color: colors.muted,
                fontFamily: fonts.sans,
                maxWidth: 600,
                lineHeight: 1.5,
              }}
            >
              Traffic light statuses show exactly where each client stands
            </p>
          </SpringIn>

          {/* Table */}
          <SpringIn delay={18} style={{ flex: 1 }}>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {/* Header row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr",
                  padding: "16px 28px",
                  borderBottom: `1px solid ${colors.border}`,
                  backgroundColor: `${colors.bg}`,
                }}
              >
                {["Client", "Filing Type", "Deadline", "Status"].map(
                  (header) => (
                    <span
                      key={header}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontFamily: fonts.sans,
                      }}
                    >
                      {header}
                    </span>
                  )
                )}
              </div>

              {/* Data rows */}
              {clients.map((client, i) => {
                const rowProgress = spring({
                  frame,
                  fps,
                  delay: 22 + i * 5,
                  config: { damping: 200 },
                });

                const sc = statusColors[client.status];

                // Pulse effect for the red (overdue) row
                const isOverdue = client.status === "red";
                const pulseOpacity = isOverdue
                  ? interpolate(
                      Math.sin(frame * 0.08),
                      [-1, 1],
                      [0, 0.06],
                    )
                  : 0;

                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr",
                      padding: "18px 28px",
                      borderBottom:
                        i < clients.length - 1
                          ? `1px solid ${colors.border}`
                          : "none",
                      alignItems: "center",
                      opacity: rowProgress,
                      transform: `translateX(${interpolate(rowProgress, [0, 1], [20, 0])}px)`,
                      backgroundColor: isOverdue
                        ? `rgba(239, 68, 68, ${pulseOpacity})`
                        : "transparent",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: colors.foreground,
                        fontFamily: fonts.sans,
                      }}
                    >
                      {client.name}
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        color: colors.muted,
                        fontFamily: fonts.sans,
                      }}
                    >
                      {client.filing}
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        color: colors.muted,
                        fontFamily: fonts.mono,
                        fontWeight: 500,
                      }}
                    >
                      {client.deadline}
                    </span>
                    <Badge
                      label={client.statusLabel}
                      bgColor={sc.bg}
                      textColor={sc.text}
                    />
                  </div>
                );
              })}
            </Card>
          </SpringIn>
        </div>
      </Background>
    </AbsoluteFill>
  );
};
