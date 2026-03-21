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

type DocItem = {
  name: string;
  verdict: string;
  verdictColor: string;
  verdictBg: string;
};

const documents: DocItem[] = [
  {
    name: "P60 — 2025/26",
    verdict: "Verified",
    verdictColor: colors.green,
    verdictBg: `${colors.green}18`,
  },
  {
    name: "Bank Statement — Mar 2026",
    verdict: "Likely match",
    verdictColor: colors.blue,
    verdictBg: `${colors.blue}18`,
  },
  {
    name: "Receipt_scan.jpg",
    verdict: "Review needed",
    verdictColor: colors.amber,
    verdictBg: `${colors.amber}18`,
  },
];

export const PortalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Upload progress animation
  const uploadProgress = interpolate(frame, [40, 75], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const uploadComplete = frame > 75;
  const checkmarkProgress = spring({
    frame,
    fps,
    delay: 78,
    config: { damping: 8, stiffness: 200 },
  });

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
          {/* Left — upload zone */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 24,
            }}
          >
            <SceneLabel text="Client Portal" delay={0} />
            <AnimatedHeading
              text="Clients upload directly"
              fontSize={52}
              delay={5}
            />
            <SpringIn delay={12}>
              <p
                style={{
                  fontSize: 20,
                  color: colors.muted,
                  fontFamily: fonts.sans,
                  lineHeight: 1.6,
                  maxWidth: 480,
                }}
              >
                Each client gets a unique, branded portal link. Documents are
                automatically verified and forwarded to your cloud storage.
              </p>
            </SpringIn>

            {/* Upload zone mockup */}
            <SpringIn delay={18}>
              <Card
                style={{
                  padding: 32,
                  borderStyle: "dashed",
                  borderWidth: 2,
                  borderColor: uploadComplete ? colors.green : colors.violet,
                  backgroundColor: uploadComplete
                    ? `${colors.green}08`
                    : `${colors.violet}08`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  maxWidth: 400,
                }}
              >
                {/* Upload icon or checkmark */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: uploadComplete
                      ? `${colors.green}15`
                      : `${colors.violet}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {uploadComplete ? (
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.green}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: `scale(${checkmarkProgress})`,
                      }}
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.violet}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                  )}
                </div>

                {/* Progress bar */}
                {frame > 35 && !uploadComplete && (
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: `${colors.violet}20`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${uploadProgress}%`,
                        borderRadius: 3,
                        background: `linear-gradient(90deg, ${colors.violet}, ${colors.blue})`,
                      }}
                    />
                  </div>
                )}

                <span
                  style={{
                    fontSize: 15,
                    color: uploadComplete ? colors.green : colors.muted,
                    fontFamily: fonts.sans,
                    fontWeight: 500,
                  }}
                >
                  {uploadComplete
                    ? "Upload complete!"
                    : frame > 35
                      ? `Uploading... ${Math.round(uploadProgress)}%`
                      : "Drop files here or click to upload"}
                </span>
              </Card>
            </SpringIn>
          </div>

          {/* Right — document intelligence results */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SpringIn delay={25}>
              <Card style={{ width: 500, padding: 32 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: `${colors.violet}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.violet}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="m9 15 2 2 4-4" />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: colors.foreground,
                      fontFamily: fonts.sans,
                    }}
                  >
                    Document Intelligence
                  </span>
                </div>

                {/* Document list */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {documents.map((doc, i) => {
                    const docDelay = 85 + i * 8;
                    const docProgress = spring({
                      frame,
                      fps,
                      delay: docDelay,
                      config: { damping: 200 },
                    });

                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 16px",
                          borderRadius: 10,
                          backgroundColor: `${colors.bg}`,
                          border: `1px solid ${colors.border}`,
                          opacity: docProgress,
                          transform: `translateX(${interpolate(docProgress, [0, 1], [-10, 0])}px)`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
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
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: colors.foreground,
                              fontFamily: fonts.sans,
                            }}
                          >
                            {doc.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: doc.verdictColor,
                            backgroundColor: doc.verdictBg,
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontFamily: fonts.sans,
                          }}
                        >
                          {doc.verdict}
                        </span>
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
