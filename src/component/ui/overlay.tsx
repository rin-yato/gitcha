import type React from "react";

export function Overlay(props: {
  children: React.ReactNode;
  backgroundColor?: string;
  onMouseUp?: () => void;
}) {
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      bottom={0}
      right={0}
      width="100%"
      height="100%"
      backgroundColor={props.backgroundColor ?? "#00000088"}
      zIndex={90}
      justifyContent="center"
      alignItems="center"
      onMouseUp={props.onMouseUp}
    >
      {props.children}
    </box>
  );
}
