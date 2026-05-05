import type { CliRenderer } from "@opentui/core";

// import type { ToastState } from "@/component/ui/toast";

import childProcess from "child_process";

export async function copyToClipboard(
  text: string,
  copyOsc52: (value: string) => boolean,
): Promise<void> {
  const platform = process.platform;

  // Try native clipboard commands
  try {
    if (platform === "darwin") {
      // macOS: use pbcopy
      await spawnClipboard("pbcopy", [], text);
      return;
    }

    if (platform === "linux") {
      // Linux: try wl-copy (Wayland), then xclip, then xsel
      const isWayland = !!process.env.WAYLAND_DISPLAY;

      if (isWayland) {
        try {
          await spawnClipboard("wl-copy", [], text);
          return;
        } catch {
          // Fall through to X11 tools
        }
      }

      try {
        await spawnClipboard("xclip", ["-selection", "clipboard"], text);
        return;
      } catch {
        // Try xsel
      }

      try {
        await spawnClipboard("xsel", ["--clipboard", "--input"], text);
        return;
      } catch {
        // Fall through to OSC52
      }
    }

    if (platform === "win32") {
      // Windows: use clip.exe
      await spawnClipboard("clip.exe", [], text);
      return;
    }
  } catch {
    // Native clipboard failed, fall through to OSC52
  }

  // Fallback: renderer OSC52 utility (works in many terminals, including over SSH)
  copyOsc52(text);
}

/**
 * Spawn a clipboard command and pipe text to it
 */
function spawnClipboard(cmd: string, args: string[], text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });

    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}

export async function copySelection(renderer: CliRenderer): Promise<void> {
  const selectedText = renderer.getSelection()?.getSelectedText();
  if (!selectedText) return;

  return (
    copyToClipboard(selectedText, renderer.copyToClipboardOSC52)
      // .then(() => toast.success("Copied to clipboard"))
      .finally(() => renderer.clearSelection())
  );
}
