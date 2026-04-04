import { testRender } from "@opentui/react/test-utils";

import { useEffect } from "react";

import {
  type CommandOption,
  CommandPromptProvider,
  useCommandPrompt,
} from "../context/command/prompt";
import type { Theme } from "../context/theme/provider";
import { CommandPrompt } from "./command-prompt";
import { expect, test } from "bun:test";

const theme: Theme = {
  background: "#000000",
  surface: "#111111",
  border: "#222222",
  text: "#ffffff",
  textMuted: "#999999",
  accent: "#00aaff",
  added: "#00ff00",
  removed: "#ff0000",
  modified: "#ffaa00",
  success: "#00ff00",
  warning: "#ffaa00",
  error: "#ff0000",
};

const options: CommandOption[] = [
  { id: "refresh", label: "Refresh", description: "Reload status", run: () => {} },
  { id: "compare", label: "Toggle Compare Mode", description: "Switch view", run: () => {} },
];

function OpenPrompt() {
  const prompt = useCommandPrompt();

  useEffect(() => {
    prompt.open();
  }, [prompt]);

  return <CommandPrompt theme={theme} options={options} onSubmit={() => {}} />;
}

test("command prompt shows command options when open", async () => {
  const setup = await testRender(
    <CommandPromptProvider>
      <OpenPrompt />
    </CommandPromptProvider>,
    { width: 100, height: 30 },
  );

  await setup.renderOnce();
  await setup.renderOnce();

  const output = JSON.stringify(setup.captureSpans().lines);
  expect(output).toContain("Command");
  expect(output).toContain("Refresh");
  expect(output).toContain("Toggle Compare Mode");
});
