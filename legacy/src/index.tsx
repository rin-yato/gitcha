#!/usr/bin/env bun

import "@opentui/react/runtime-plugin-support";

import { addDefaultParsers, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { bootstrapReviewSession } from "@/context/session/session";

import { buildCli } from "@/lib/cli";
import { createDefaultAppConfig, loadAppConfig } from "@/lib/config";
import { parsers } from "@/lib/treesitter/parsers";
import { upgradeApp } from "@/lib/upgrade";

import { AppRootWithBootstrap } from "@/app";
import { registerRenderables } from "@/renderable/register";

const version = process.env.CHANGES_APP_VERSION ?? "dev";
const cli = buildCli(version);

if (cli.shouldShowVersion) {
  console.log(version);
  process.exit(0);
}

if (cli.shouldShowHelp) {
  console.log(cli.helpText);
  process.exit(0);
}

if (cli.command === "upgrade") {
  const code = await upgradeApp();
  process.exit(code);
}

addDefaultParsers(parsers);
registerRenderables();

const bootstrap = bootstrapReviewSession();
const config = await loadAppConfig().catch(() => createDefaultAppConfig());
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
  if (key.name === "`" || (key.ctrl && key.name === "l")) {
    renderer.console.toggle();
    return;
  }

  if (key.name === "y" && key.ctrl) {
    renderer.copyToClipboardOSC52(renderer.getSelection()?.getSelectedText() ?? "");
    return;
  }

  if (key.name === "c" && key.ctrl) {
    renderer.destroy();
  }
});

createRoot(renderer as never).render(
  <AppRootWithBootstrap bootstrap={bootstrap} initialConfig={config} />,
);
