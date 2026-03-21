import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../../components/shared";
import { colors, fonts } from "../../components/theme";

// Matches the hero section: left-aligned, massive heading, violet pill CTA
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Word-by-word heading — matches hero spring config exactly
  const headingWords = ["The", "Chase", "Is", "Over"];

  // Tagline — delay 0.42s = ~13 frames
  const taglineProgress = spring({
    frame,
    fps,
    delay: 13,
    config: { stiffness: 100, damping: 12 },
  });

  // Button — delay 0.54s = ~16 frames
  const buttonProgress = spring({
    frame,
    fps,
    delay: 16,
    config: { stiffness: 100, damping: 12 },
  });

  // Logo — appears first
  const logoProgress = spring({
    frame,
    fps,
    delay: 0,
    config: { stiffness: 100, damping: 12 },
  });

  return (
    <AbsoluteFill>
      <Background>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            height: "100%",
            padding: "0 100px",
            gap: 16,
            maxWidth: 1280,
          }}
        >
          {/* Logo + brand name — like nav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
              opacity: logoProgress,
              transform: `translateY(${interpolate(logoProgress, [0, 1], [20, 0])}px)`,
            }}
          >
            {/* Prompt logo icon (bell) */}
            <div
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: colors.foreground,
                fontFamily: fonts.sans,
              }}
            >
              Prompt
            </span>
          </div>

          {/* Massive heading — text-8xl/9xl equivalent, word-by-word */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.25em",
              lineHeight: 0.95,
            }}
          >
            {headingWords.map((word, i) => {
              const wordProgress = spring({
                frame,
                fps,
                delay: i * 2.4, // 0.08s * 30fps = 2.4 frames per word
                config: { stiffness: 100, damping: 12 },
              });

              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontSize: 140,
                    fontWeight: 700,
                    color: colors.foreground,
                    fontFamily: fonts.sans,
                    letterSpacing: "-0.03em",
                    opacity: wordProgress,
                    transform: `translateY(${interpolate(wordProgress, [0, 1], [20, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Tagline — text-base text-muted-foreground, max-w-lg */}
          <div
            style={{
              opacity: taglineProgress,
              transform: `translateY(${interpolate(taglineProgress, [0, 1], [20, 0])}px)`,
              maxWidth: 520,
              marginTop: 8,
            }}
          >
            <p
              style={{
                fontSize: 20,
                color: colors.muted,
                fontFamily: fonts.sans,
                fontWeight: 400,
                lineHeight: 1.65,
              }}
            >
              Automated client reminders for UK accounting practices. Stop
              manually chasing records and documents — Prompt handles it for
              you.
            </p>
          </div>

          {/* CTA — rounded-full bg-violet-600 pill with shadow-violet-500/30 */}
          <div
            style={{
              marginTop: 16,
              opacity: buttonProgress,
              transform: `translateY(${interpolate(buttonProgress, [0, 1], [20, 0])}px)`,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 9999,
                backgroundColor: "#7c3aed", // violet-600
                padding: "18px 40px",
                fontSize: 20,
                fontWeight: 600,
                color: "white",
                fontFamily: fonts.sans,
                boxShadow: "0 4px 14px rgba(139, 92, 246, 0.3)", // shadow-violet-500/30
              }}
            >
              Find out more
              {/* ChevronDown icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>
      </Background>
    </AbsoluteFill>
  );
};
