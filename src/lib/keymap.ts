import type { CliRenderer } from "@opentui/core";
import * as addons from "@opentui/keymap/addons/opentui";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";

export function createAppKeymap(renderer: CliRenderer) {
  const keymap = createDefaultOpenTuiKeymap(renderer);

  addons.registerNeovimDisambiguation(keymap);
  addons.registerEscapeClearsPendingSequence(keymap);
  addons.registerBackspacePopsPendingSequence(keymap);

  return keymap;
}
