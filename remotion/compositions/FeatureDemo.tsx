import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { IntroScene } from "./scenes/IntroScene";
import { DeadlineScene } from "./scenes/DeadlineScene";
import { ReminderScene } from "./scenes/ReminderScene";
import { PortalScene } from "./scenes/PortalScene";
import { OutroScene } from "./scenes/OutroScene";
import { loadFont } from "@remotion/google-fonts/Figtree";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const FeatureDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <TransitionSeries>
        {/* Intro — 3s */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Deadline tracking — 4s */}
        <TransitionSeries.Sequence durationInFrames={120}>
          <DeadlineScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Automated reminders — 4s */}
        <TransitionSeries.Sequence durationInFrames={120}>
          <ReminderScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Client portal — 4.5s */}
        <TransitionSeries.Sequence durationInFrames={135}>
          <PortalScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Outro CTA — 2.5s */}
        <TransitionSeries.Sequence durationInFrames={75}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
