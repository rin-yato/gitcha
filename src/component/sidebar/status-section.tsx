import { createMemo, For, Show } from "solid-js";

import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

import type { GitStatusFile } from "@/lib/git";

export interface StatusSection {
  title: string;
  kind: "conflicts" | "staged" | "changes";
  files: GitStatusFile[];
  count: number;
  selectedPath?: string | null;
}

type StatusRowProps = {
  file: GitStatusFile;
  kind: StatusSection["kind"];
  selectedPath?: string | null;
  accentFg: string;
};

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

function StatusRow(props: StatusRowProps) {
  const isSelected = createMemo(() => props.file.path === props.selectedPath);
  const statusLabel = createMemo(() => formatSectionStatus(props.kind, props.file));

  return (
    <box
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
      backgroundColor={isSelected() ? $theme.token.accent : undefined}
      onMouseUp={() => $sidebar.action.setSelectedPath(props.file.path)}
    >
      <text truncate maxHeight={1} wrapMode="char" attributes={isSelected() ? 1 : 0}>
        <span style={{ fg: isSelected() ? $theme.token.accentFg : props.accentFg }}>
          {statusLabel()}
        </span>

        <span style={{ fg: isSelected() ? $theme.token.accentFg : $theme.token.fgMuted }}>
          &nbsp;{props.file.path}
        </span>
      </text>
    </box>
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
        <box paddingLeft={1}>
          <text fg={$theme.token.fg}>
            {props.section.title}&nbsp;
            <span style={{ fg: sectionAccentFg() }}>{props.section.count}</span>
          </text>
        </box>

        <For each={props.section.files}>
          {(file) => (
            <StatusRow
              file={file}
              kind={props.section.kind}
              selectedPath={props.section.selectedPath}
              accentFg={sectionAccentFg()}
            />
          )}
        </For>
      </box>
    </Show>
  );
}
