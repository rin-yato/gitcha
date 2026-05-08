import { createMemo, For, Show } from "solid-js";

import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

import type { GitFileTarget, GitStatusFile } from "@/lib/git";
import { createGitFileTarget, isGitFileTargetEqual } from "@/lib/git";

import type { SidebarSectionModel } from "./utils";

export interface StatusSectionProps {
  section: SidebarSectionModel & {
    selectedTarget?: GitFileTarget | null;
  };
}

type StatusSectionRow = SidebarSectionModel & {
  selectedTarget?: GitFileTarget | null;
};

type StatusRowProps = {
  file: GitStatusFile;
  kind: SidebarSectionModel["kind"];
  selectedTarget?: GitFileTarget | null;
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
  section: SidebarSectionModel["kind"],
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
  const target = createMemo(() => createGitFileTarget(props.kind, props.file.path));
  const isSelected = createMemo(() => isGitFileTargetEqual(target(), props.selectedTarget));
  const statusLabel = createMemo(() => formatSectionStatus(props.kind, props.file));

  return (
    <box
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
      backgroundColor={isSelected() ? $theme.token.accent : undefined}
      onMouseUp={() => $sidebar.action.setSelectedTarget(target())}
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

export function StatusSection(props: StatusSectionProps) {
  const section = createMemo<StatusSectionRow>(() => props.section);
  const sectionAccentFg = createMemo(() => {
    if (section().kind === "conflicts") return $theme.token.removed;
    if (section().kind === "staged") return $theme.token.added;
    if (section().kind === "changes") return $theme.token.modified;
    return $theme.token.fg;
  });

  return (
    <Show when={section().count}>
      <box flexDirection="column">
        <box paddingLeft={1}>
          <text fg={$theme.token.fg}>
            {section().title}&nbsp;
            <span style={{ fg: sectionAccentFg() }}>{props.section.count}</span>
          </text>
        </box>

        <For each={section().files}>
          {(file) => (
            <StatusRow
              file={file}
              kind={section().kind}
              selectedTarget={section().selectedTarget}
              accentFg={sectionAccentFg()}
            />
          )}
        </For>
      </box>
    </Show>
  );
}
