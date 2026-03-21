import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { colors, fonts } from "./theme";

// ─── Animated background ───
export const Background: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: colors.bg,
        fontFamily: fonts.sans,
        color: colors.foreground,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${colors.border}40 1px, transparent 1px),
            linear-gradient(90deg, ${colors.border}40 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: 0.5,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
};

// ─── Spring-in wrapper ───
export const SpringIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  style?: React.CSSProperties;
}> = ({ children, delay = 0, direction = "up", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, delay, config: { damping: 200 } });

  const offsets = {
    up: { x: 0, y: 30 },
    down: { x: 0, y: -30 },
    left: { x: 30, y: 0 },
    right: { x: -30, y: 0 },
  };

  const offset = offsets[direction];

  return (
    <div
      style={{
        opacity: progress,
        transform: `translate(${interpolate(progress, [0, 1], [offset.x, 0])}px, ${interpolate(progress, [0, 1], [offset.y, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── Word-by-word heading (matching hero animation) ───
export const AnimatedHeading: React.FC<{
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  fontWeight?: number;
}> = ({
  text,
  fontSize = 72,
  color = colors.foreground,
  delay = 0,
  fontWeight = 700,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25em" }}>
      {words.map((word, i) => {
        const wordDelay = delay + i * 3; // 3 frames between each word
        const progress = spring({
          frame,
          fps,
          delay: wordDelay,
          config: { stiffness: 100, damping: 12 },
        });

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontSize,
              fontWeight,
              color,
              opacity: progress,
              transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
              letterSpacing: "-0.02em",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ─── Badge component ───
export const Badge: React.FC<{
  label: string;
  bgColor: string;
  textColor: string;
}> = ({ label, bgColor, textColor }) => {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 14px",
        borderRadius: 8,
        backgroundColor: bgColor,
        color: textColor,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: fonts.sans,
      }}
    >
      {label}
    </span>
  );
};

// ─── Card wrapper ───
export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  return (
    <div
      style={{
        background: colors.bgCard,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        padding: 32,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── Scene label (top-left pill) ───
export const SceneLabel: React.FC<{ text: string; delay?: number }> = ({
  text,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 20px",
        borderRadius: 100,
        backgroundColor: `${colors.violet}15`,
        border: `1px solid ${colors.violet}30`,
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [10, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: colors.violet,
        }}
      />
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.violet,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          fontFamily: fonts.sans,
        }}
      >
        {text}
      </span>
    </div>
  );
};
