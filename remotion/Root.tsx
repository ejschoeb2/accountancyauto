import { Composition, Folder } from "remotion";
import { FeatureDemo } from "./compositions/FeatureDemo";

export const RemotionRoot = () => {
  return (
    <Folder name="Marketing">
      <Composition
        id="FeatureDemo"
        component={FeatureDemo}
        durationInFrames={480}
        fps={30}
        width={1920}
        height={1080}
      />
    </Folder>
  );
};
