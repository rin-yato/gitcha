import { createMemo, For, Show } from "solid-js";

import { $theme } from "@/store/theme.store";

import type { GitStatusFile } from "@/lib/git";

export interface StatusSection {
  title: string;
  kind: "conflicts" | "staged" | "changes";
  files: GitStatusFile[];
  count: number;
}

function formatStatusLabel(status: string) {
  switch (status) {
    case "?":
      return "?";
    case "A":
      return "A";
    case "M":
      return "M";
    case "D":
      return "D";
    case "R":
      return "R";
    case "C":
      return "C";
    case "U":
      return "U";
    case "!":
      return "!";
    case "T":
      return "T";
    default:
      return " ";
  }
}

function formatSectionStatus(
  section: "conflicts" | "staged" | "changes",
  file: {
    indexStatus: string;
    workingTreeStatus: string;
  },
) {
  if (section === "staged") return formatStatusLabel(file.indexStatus);
  if (section === "changes") {
    return file.indexStatus === "?"
      ? "?"
      : formatStatusLabel(file.workingTreeStatus).trim() || formatStatusLabel(file.indexStatus);
  }

  return (
    formatStatusLabel(file.indexStatus).trim() || formatStatusLabel(file.workingTreeStatus)
  );
}

export function StatusSection(props: { section: StatusSection }) {
  const sectionAccentFg = createMemo(() => {
    if (props.section.kind === "conflicts") return $theme.token.removed;
    if (props.section.kind === "staged") return $theme.token.added;
    if (props.section.kind === "changes") return $theme.token.modified;
    return $theme.token.fg;
  });

  return (
    <Show when={props.section.count}>
      <box flexDirection="column">
        <text fg="black">
          {props.section.title}&nbsp;
          <span style={{ fg: sectionAccentFg() }}>{props.section.count}</span>
        </text>

        <For each={props.section.files}>
          {(file) => (
            <text fg="black" truncate maxHeight={1} overflow="hidden" wrapMode="char">
              <span style={{ fg: sectionAccentFg() }}>
                {formatSectionStatus(props.section.kind, file)}
              </span>
              <span style={{ fg: $theme.token.fgMuted }}>&nbsp;{file.path}</span>
            </text>
          )}
        </For>
      </box>
    </Show>
  );
}
