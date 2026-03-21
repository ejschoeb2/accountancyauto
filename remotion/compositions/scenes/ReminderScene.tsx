import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import {
  Background,
  AnimatedHeading,
  SpringIn,
  Card,
  SceneLabel,
} from "../../components/shared";
import { colors, fonts } from "../../components/theme";

type ReminderStep = {
  daysLabel: string;
  template: string;
  color: string;
};

const steps: ReminderStep[] = [
  { daysLabel: "30 days", template: "Friendly Reminder", color: colors.blue },
  { daysLabel: "14 days", template: "Follow-Up", color: colors.amber },
  { daysLabel: "7 days", template: "Urgent Final Notice", color: colors.red },
];

export const ReminderScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Background>
        <div
          style={{
            display: "flex",
            padding: "60px 80px",
            height: "100%",
            gap: 60,
          }}
        >
          {/* Left side — text */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 24,
            }}
          >
            <SceneLabel text="Automated Reminders" delay={0} />
            <AnimatedHeading
              text="Set it and forget it"
              fontSize={56}
              delay={5}
            />
            <SpringIn delay={12}>
              <p
                style={{
                  fontSize: 22,
                  color: colors.muted,
                  fontFamily: fonts.sans,
                  lineHeight: 1.6,
                  maxWidth: 500,
                }}
              >
                Configure reminder schedules once. Prompt sends the right email
                at the right time — escalating automatically as deadlines
                approach.
              </p>
            </SpringIn>
          </div>

          {/* Right side — timeline visualization */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SpringIn delay={15}>
              <Card style={{ padding: 40, width: 520 }}>
                {/* Schedule header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 32,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `${colors.violet}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.violet}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: colors.foreground,
                        fontFamily: fonts.sans,
                      }}
                    >
                      Corporation Tax Payment
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: colors.muted,
                        fontFamily: fonts.sans,
                      }}
                    >
                      3 reminder steps
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    position: "relative",
                  }}
                >
                  {steps.map((step, i) => {
                    const stepDelay = 22 + i * 8;
                    const stepProgress = spring({
                      frame,
                      fps,
                      delay: stepDelay,
                      config: { damping: 200 },
                    });

                    // Envelope fly-in
                    const envelopeProgress = spring({
                      frame,
                      fps,
                      delay: stepDelay + 6,
                      config: { damping: 12, stiffness: 100 },
                    });

                    return (
                      <div key={i} style={{ display: "flex", gap: 20 }}>
                        {/* Timeline line + dot */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            width: 24,
                          }}
                        >
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              backgroundColor: step.color,
                              opacity: stepProgress,
                              transform: `scale(${stepProgress})`,
                              boxShadow: `0 0 0 4px ${step.color}25`,
                              flexShrink: 0,
                            }}
                          />
                          {i < steps.length - 1 && (
                            <div
                              style={{
                                width: 2,
                                flex: 1,
                                backgroundColor: colors.border,
                                opacity: stepProgress,
                              }}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div
                          style={{
                            paddingBottom: i < steps.length - 1 ? 28 : 0,
                            opacity: stepProgress,
                            transform: `translateX(${interpolate(stepProgress, [0, 1], [15, 0])}px)`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: step.color,
                              fontFamily: fonts.mono,
                              marginBottom: 4,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {step.daysLabel} before deadline
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            {/* Mini envelope icon */}
                            <div
                              style={{
                                opacity: envelopeProgress,
                                transform: `translateX(${interpolate(envelopeProgress, [0, 1], [-10, 0])}px) scale(${interpolate(envelopeProgress, [0, 1], [0.8, 1])})`,
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={colors.muted}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  width="20"
                                  height="16"
                                  x="2"
                                  y="4"
                                  rx="2"
                                />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                              </svg>
                            </div>
                            <span
                              style={{
                                fontSize: 16,
                                fontWeight: 500,
                                color: colors.foreground,
                                fontFamily: fonts.sans,
                              }}
                            >
                              {step.template}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </SpringIn>
          </div>
        </div>
      </Background>
    </AbsoluteFill>
  );
};
