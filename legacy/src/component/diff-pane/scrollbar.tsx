import { memo } from "react";

import { SCROLLBAR_WIDTH } from "./utils";

const Marker = memo(function Marker({ position, color }: { position: number; color: string }) {
  return <text content="▎" fg={color} position="absolute" top={`${position * 100}%`} />;
});

interface ScrollbarMarkersProps {
  markers: Array<{
    position: number;
    type: "addition" | "deletion";
  }>;
  addedColor: string;
  removedColor: string;
}

export const ScrollbarMarkers = memo(function ScrollbarMarkers(props: ScrollbarMarkersProps) {
  const { markers, addedColor, removedColor } = props;

  return (
    <>
      {markers.map((marker, index) => (
        <Marker
          key={index}
          position={marker.position}
          color={marker.type === "addition" ? addedColor : removedColor}
        />
      ))}
    </>
  );
});

interface ScrollbarThumbProps {
  top: number;
  height: number;
  color: string;
}

const ScrollbarThumb = memo(function ScrollbarThumb(props: ScrollbarThumbProps) {
  return (
    <box
      position="absolute"
      top={props.top}
      width={SCROLLBAR_WIDTH}
      height={props.height}
      backgroundColor={props.color}
    />
  );
});

interface ScrollbarProps {
  thumbTop: number;
  thumbHeight: number;
  surfaceColor: string;
  thumbColor: string;
  markers: Array<{
    position: number;
    type: "addition" | "deletion";
  }>;
  addedColor: string;
  removedColor: string;
}

export const Scrollbar = memo(function Scrollbar(props: ScrollbarProps) {
  const { thumbTop, thumbHeight, surfaceColor, thumbColor, markers, addedColor, removedColor } =
    props;

  return (
    <box
      width={SCROLLBAR_WIDTH}
      height="100%"
      flexShrink={0}
      backgroundColor={surfaceColor}
      position="relative"
      overflow="hidden"
    >
      <ScrollbarThumb top={thumbTop} height={thumbHeight} color={thumbColor} />
      <ScrollbarMarkers markers={markers} addedColor={addedColor} removedColor={removedColor} />
    </box>
  );
});
