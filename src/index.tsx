#!/usr/bin/env bun

import { addDefaultParsers, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { parsers } from "@/lib/tree-sitter";

import { AppRoot } from "@/app";

addDefaultParsers(parsers);

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  autoFocus: false,
  externalOutputMode: "passthrough",
  gatherStats: false,
  maxFps: 60,
  onDestroy: () => {
    process.exit(0);
  },
});

renderer.keyInput.on("keypress", (key) => {
  // Toggle with backtick key
  if (key.name === "`") {
    renderer.console.toggle();
  }

  // Or with a modifier
  if (key.ctrl && key.name === "l") {
    renderer.console.toggle();
  }

  // handle copy selection
  if (key.name === "y" && key.ctrl) {
    renderer.copyToClipboardOSC52(renderer.getSelection()?.getSelectedText() ?? "");
  }

  if (key.name === "c" && key.ctrl) {
    renderer.destroy();
  }
});

createRoot(renderer as never).render(<AppRoot />);
