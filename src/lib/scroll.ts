import type { ScrollAcceleration } from "@opentui/core";

export class CustomSpeedScroll implements ScrollAcceleration {
  constructor(private speed: number) {}

  tick(_now?: number): number {
    return this.speed;
  }

  reset(): void {}
}

export function getScrollAcceleration(): ScrollAcceleration {
  // if (tuiConfig?.scroll_acceleration?.enabled) {
  //   return new MacOSScrollAccel();
  // }

  // if (tuiConfig?.scroll_speed !== undefined) {
  //   return new CustomSpeedScroll(tuiConfig.scroll_speed);
  // }

  return new CustomSpeedScroll(3);
}
