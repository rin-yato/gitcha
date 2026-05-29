import type { CliRenderer } from "@opentui/core";

import { Result } from "better-result";
import { spawn } from "child_process";

export async function copyToClipboard(
  text: string,
  copyOsc52: (value: string) => boolean,
): Promise<Result<void, Error>> {
  for (const { cmd, args } of getClipboardCommands()) {
    const result = await trySpawnClipboard(cmd, args, text);
    if (Result.isOk(result)) return result;
  }

  if (copyOsc52(text)) return Result.ok(undefined);

  return Result.err(new Error("Failed to copy to clipboard"));
}

function getClipboardCommands(): Array<{ cmd: string; args: string[] }> {
  if (process.platform === "darwin") return [{ cmd: "pbcopy", args: [] }];
  if (process.platform === "win32") return [{ cmd: "clip.exe", args: [] }];
  if (process.platform !== "linux") return [];

  return process.env.WAYLAND_DISPLAY
    ? [
        { cmd: "wl-copy", args: [] },
        { cmd: "xclip", args: ["-selection", "clipboard"] },
        { cmd: "xsel", args: ["--clipboard", "--input"] },
      ]
    : [
        { cmd: "xclip", args: ["-selection", "clipboard"] },
        { cmd: "xsel", args: ["--clipboard", "--input"] },
      ];
}

function trySpawnClipboard(
  cmd: string,
  args: string[],
  text: string,
): Promise<Result<void, Error>> {
  return Result.tryPromise({
    try: async () => {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });

        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`${cmd} exited with code ${code ?? "unknown"}`));
        });

        proc.stdin?.write(text);
        proc.stdin?.end();
      });
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
}

export async function copySelection(
  renderer: CliRenderer,
  onSuccess: () => void,
  onError: (message: string) => void,
): Promise<void> {
  const selectedText = renderer.getSelection()?.getSelectedText();
  if (!selectedText) return;

  const result = await copyToClipboard(selectedText, renderer.copyToClipboardOSC52);

  if (Result.isOk(result)) {
    onSuccess();
  } else {
    onError(result.error.message);
  }

  renderer.clearSelection();
}
