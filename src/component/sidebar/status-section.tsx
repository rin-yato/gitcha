import { createMemo, For, Show } from "solid-js";

import type { GitFileSection, GitFileTarget, GitStatusFile } from "@/lib/git";
import { createGitFileTarget, isGitFileTargetEqual } from "@/lib/git";

import type { SidebarSectionViewModel } from "./utils";
import { useSidebar } from "@/context/sidebar";
import { createSidebarFileId } from "@/context/sidebar/sidebar-key";
import { useTheme } from "@/context/theme";

const DIRECTORY_ICONS = {
  closed: "▸",
  open: "▾",
} as const;

export interface StatusSectionProps {
  section: SidebarSectionViewModel & {
    selectedTarget?: GitFileTarget | null;
  };
}

type StatusRowProps = {
  file: GitStatusFile;
  kind: GitFileSection;
  label: string;
  selectedTarget?: GitFileTarget | null;
  accentFg: string;
  depth?: number;
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
  section: GitFileSection,
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
  const sidebar = useSidebar();
  const theme = useTheme();
  const target = createMemo(() => createGitFileTarget(props.kind, props.file.path));
  const isSelected = createMemo(() => isGitFileTargetEqual(target(), props.selectedTarget));
  const statusLabel = createMemo(() => formatSectionStatus(props.kind, props.file));

  return (
    <box
      id={createSidebarFileId(target().section, target().path)}
      width="100%"
      paddingLeft={1 + (props.depth ?? 0) * 2}
      paddingRight={1}
      overflow="hidden"
      backgroundColor={isSelected() ? theme.state.token.accent : undefined}
      onMouseUp={() => sidebar.setSelectedTarget(target())}
    >
      <text truncate maxHeight={1} wrapMode="char" attributes={isSelected() ? 1 : 0}>
        <span style={{ fg: isSelected() ? theme.state.token.accentFg : props.accentFg }}>
          {statusLabel()}
        </span>

        <span
          style={{ fg: isSelected() ? theme.state.token.accentFg : theme.state.token.fgMuted }}
        >
          &nbsp;{props.label}
        </span>
      </text>
    </box>
  );
}

export function StatusSection(props: StatusSectionProps) {
  const sidebar = useSidebar();
  const theme = useTheme();
  const sectionAccentFg = createMemo(() => {
    if (props.section.kind === "conflicts") return theme.state.token.removed;
    if (props.section.kind === "staged") return theme.state.token.added;
    if (props.section.kind === "changes") return theme.state.token.modified;
    return theme.state.token.fg;
  });

  return (
    <Show when={props.section.count}>
      <box flexDirection="column">
        <box paddingLeft={1}>
          <text fg={theme.state.token.fg}>
            {props.section.title}&nbsp;
            <span style={{ fg: sectionAccentFg() }}>{props.section.count}</span>
          </text>
        </box>

        <For each={props.section.rows}>
          {(row) =>
            row.kind === "file" ? (
              <StatusRow
                file={row.file}
                kind={row.section}
                label={row.name}
                selectedTarget={props.section.selectedTarget}
                accentFg={sectionAccentFg()}
                depth={row.depth}
              />
            ) : (
              <box
                paddingLeft={1 + row.depth * 2}
                width="100%"
                overflow="hidden"
                flexDirection="row"
                alignItems="center"
                onMouseUp={() => sidebar.toggleDirectory(row.key)}
                gap={1}
              >
                <text fg={theme.state.token.fgMuted}>
                  {row.isCollapsed ? DIRECTORY_ICONS.closed : DIRECTORY_ICONS.open}
                </text>

                <text fg={theme.state.token.fgMuted} truncate maxHeight={1} wrapMode="char">
                  {row.name}
                </text>
              </box>
            )
          }
        </For>
      </box>
    </Show>
  );
}
