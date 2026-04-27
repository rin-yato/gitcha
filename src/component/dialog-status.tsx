import { useKeyboard } from "@opentui/react";

import { useEffect, useState } from "react";

import type { Theme } from "@/context/theme/provider";

import {
  APP_GITHUB_REPOSITORY,
  classifyInstallMethod,
  getAppVersion,
  getInstalledPath,
} from "@/lib/app-status";
import type { RepoMonitorMode } from "@/lib/git";

type ReleaseState =
  | { status: "loading" }
  | { status: "loaded"; version: string | null }
  | { status: "error" };

export type StatusDialogProps = {
  theme: Theme;
  gitRoot: string | null;
  watcherMode: RepoMonitorMode | null;
  onClose: () => void;
};

function StatusRow(props: { theme: Theme; label: string; value: string }) {
  return (
    <box flexDirection="row" justifyContent="space-between" gap={2}>
      <text fg={props.theme.textMuted} selectable={false}>
        {props.label}
      </text>
      <text fg={props.theme.text} selectable={false} truncate>
        {props.value}
      </text>
    </box>
  );
}

async function fetchLatestRelease(): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${APP_GITHUB_REPOSITORY.owner}/${APP_GITHUB_REPOSITORY.repo}/releases/latest`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "gitcha",
      },
    },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as { tag_name?: string; name?: string };
  return payload.tag_name ?? payload.name ?? null;
}

export function StatusDialog(props: StatusDialogProps) {
  const { theme, gitRoot, watcherMode, onClose } = props;
  const [release, setRelease] = useState<ReleaseState>({ status: "loading" });

  const appVersion = getAppVersion();
  const installedPath = getInstalledPath();
  const installMethod = classifyInstallMethod(process.execPath, installedPath);

  useEffect(() => {
    let cancelled = false;

    void fetchLatestRelease()
      .then((version) => {
        if (cancelled) return;
        setRelease({ status: "loaded", version });
      })
      .catch(() => {
        if (cancelled) return;
        setRelease({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useKeyboard((event) => {
    if (event.name !== "escape") return;
    event.preventDefault();
    onClose();
  });

  const releaseLabel =
    release.status === "loading"
      ? "Checking..."
      : release.status === "error"
        ? "Unavailable"
        : (release.version ?? "Unavailable");

  return (
    <box
      width={62}
      paddingX={2}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor={theme.surface}
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={theme.text} attributes={1} selectable={false}>
          Status
        </text>
        <text fg={theme.textMuted} selectable={false} onMouseUp={onClose}>
          esc
        </text>
      </box>

      <box>
        <StatusRow theme={theme} label="Health" value={gitRoot ? "ready" : "unavailable"} />
        <StatusRow theme={theme} label="Watcher" value={watcherMode ?? "starting"} />
        <StatusRow theme={theme} label="Git root" value={gitRoot ?? "Not available"} />
        <StatusRow theme={theme} label="Install" value={installMethod} />
        <StatusRow theme={theme} label="Version" value={appVersion} />
        <StatusRow theme={theme} label="New version" value={releaseLabel} />
      </box>
    </box>
  );
}
