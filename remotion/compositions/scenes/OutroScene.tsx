import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background, SpringIn } from "../../components/shared";
import { colors, fonts } from "../../components/theme";

// Matches the bridge-cta-section: centered, eyebrow label, heading, subheading, violet pill CTA
export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Eyebrow
  const eyebrowProgress = spring({
    frame,
    fps,
    delay: 0,
    config: { stiffness: 100, damping: 12 },
  });

  // Heading words
  const headingWords = ["Everything", "you", "need.", "Set", "up", "in", "minutes."];

  // Subheading
  const subProgress = spring({
    frame,
    fps,
    delay: 14,
    config: { stiffness: 100, damping: 12 },
  });

  // Button
  const buttonProgress = spring({
    frame,
    fps,
    delay: 20,
    config: { stiffness: 100, damping: 12 },
  });

  return (
    <AbsoluteFill>
      <Background>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: 80,
            gap: 20,
            textAlign: "center",
          }}
        >
          {/* Eyebrow — text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground */}
          <div
            style={{
              opacity: eyebrowProgress,
              transform: `translateY(${interpolate(eyebrowProgress, [0, 1], [20, 0])}px)`,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: colors.muted,
                fontFamily: fonts.sans,
              }}
            >
              That&apos;s the core
            </span>
          </div>

          {/* Heading — text-3xl lg:text-4xl font-bold, word-by-word */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.3em",
              maxWidth: 800,
              lineHeight: 1.15,
            }}
          >
            {headingWords.map((word, i) => {
              const wordProgress = spring({
                frame,
                fps,
                delay: 3 + i * 2,
                config: { stiffness: 100, damping: 12 },
              });

              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontSize: 64,
                    fontWeight: 700,
                    color: colors.foreground,
                    fontFamily: fonts.sans,
                    letterSpacing: "-0.02em",
                    opacity: wordProgress,
                    transform: `translateY(${interpolate(wordProgress, [0, 1], [20, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Subheading — text-base text-muted-foreground max-w-lg */}
          <div
            style={{
              opacity: subProgress,
              transform: `translateY(${interpolate(subProgress, [0, 1], [20, 0])}px)`,
              maxWidth: 580,
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
              Deadline tracking, automated reminders, and email management — all
              you need to stop chasing clients.
            </p>
          </div>

          {/* CTA — identical to hero: rounded-full bg-violet-600 pill */}
          <div
            style={{
              marginTop: 20,
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
              Get started free
              {/* ArrowRight icon */}
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
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Trust signals — checkmarks like the feature pills */}
          <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
            {["No credit card required", "14-day free trial", "Set up in 5 minutes"].map(
              (text, i) => {
                const pillProgress = spring({
                  frame,
                  fps,
                  delay: 26 + i * 3,
                  config: { damping: 200 },
                });
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: pillProgress,
                      transform: `translateY(${interpolate(pillProgress, [0, 1], [8, 0])}px)`,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.green}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span
                      style={{
                        fontSize: 15,
                        color: colors.muted,
                        fontFamily: fonts.sans,
                        fontWeight: 500,
                      }}
                    >
                      {text}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </Background>
    </AbsoluteFill>
  );
};
