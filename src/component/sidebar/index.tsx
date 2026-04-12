export * from "./file-item";
export * from "./file-list";
export * from "./types";
export * from "./utils";

import type { ScrollBoxRenderable } from "@opentui/core";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { FileSection, SelectionSource, ViewMode } from "@/context/changes/state";
import type { Theme } from "@/context/theme/provider";

import type { CompareState, GitRepoStatus, GitStatusFile } from "@/lib/git";

import {
  buildFileKey,
  getFileStatus,
  getStatusColor,
  getStatusIcon,
  formatFilePath,
} from "./utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarProps = {
  theme: Theme;
  status: GitRepoStatus | null;
  error: string | null;
  selectedFileKey: string | null;
  focusedFileKey: string | null;
  selectionSource: SelectionSource;
  selectFile: (path: string, section: FileSection) => void;
  viewMode: ViewMode;
  compareState: CompareState | null;
  isOpen: boolean;
  width: number;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function getStagedFiles(status: GitRepoStatus | null): GitStatusFile[] {
  return status?.files.staged ?? [];
}

function getChangeFiles(status: GitRepoStatus | null): GitStatusFile[] {
  if (!status) return [];
  return [...status.files.changes, ...status.files.untracked];
}

function getCompareFiles(compareState: CompareState | null): GitStatusFile[] {
  return compareState?.files ?? [];
}

function isEmptyRepo(status: GitRepoStatus | null): boolean {
  if (!status?.isRepo) return true;
  return status.totalFiles === 0;
}

type SidebarRow =
  | { kind: "section"; key: string; label: string; count: number; countColor: string }
  | { kind: "file"; key: string; file: GitStatusFile; section: FileSection };

function buildSidebarRows(args: {
  theme: Theme;
  viewMode: ViewMode;
  staged: GitStatusFile[];
  changes: GitStatusFile[];
  compareFiles: GitStatusFile[];
  isEmpty: boolean;
}): SidebarRow[] {
  const { theme, viewMode, staged, changes, compareFiles, isEmpty } = args;
  if (viewMode === "compare") {
    if (compareFiles.length === 0) {
      return [];
    }

    return [
      {
        kind: "section",
        key: "section:compare",
        label: "Changes",
        count: compareFiles.length,
        countColor: theme.modified,
      },
      ...compareFiles.map((file) => ({
        kind: "file" as const,
        key: buildFileKey("compare", file.path),
        file,
        section: "compare" as const,
      })),
    ];
  }

  if (isEmpty) return [];

  return [
    {
      kind: "section",
      key: "section:staged",
      label: "Staged",
      count: staged.length,
      countColor: theme.added,
    },
    ...staged.map((file) => ({
      kind: "file" as const,
      key: buildFileKey("staged", file.path),
      file,
      section: "staged" as const,
    })),
    {
      kind: "section",
      key: "section:changes",
      label: "Changes",
      count: changes.length,
      countColor: theme.modified,
    },
    ...changes.map((file) => ({
      kind: "file" as const,
      key: buildFileKey("changes", file.path),
      file,
      section: "changes" as const,
    })),
  ];
}

function SidebarSectionHeader(props: {
  label: string;
  count: number;
  countColor: string;
  theme: Theme;
}) {
  return (
    <box flexDirection="row" paddingLeft={1} paddingBottom={0}>
      <text
        content={props.label}
        fg={props.theme.textMuted}
        attributes={1}
        selectable={false}
      />
      <text content=" " selectable={false} />
      <text content={String(props.count)} fg={props.countColor} selectable={false} />
    </box>
  );
}

function SidebarRowView(props: {
  file: GitStatusFile;
  section: FileSection;
  theme: Theme;
  isActive: boolean;
  onSelect: () => void;
}) {
  const status = getFileStatus(props.file);
  const icon = getStatusIcon(status);
  const statusColor = getStatusColor(status, props.theme);

  const bgColor = props.isActive ? props.theme.accent : undefined;
  const nameColor = props.isActive ? props.theme.background : statusColor;
  const iconColor = props.isActive ? props.theme.background : statusColor;
  const fileLabel = formatFilePath(props.file.path);

  return (
    <box
      id={buildFileKey(props.section, props.file.path)}
      onMouseUp={props.onSelect}
      flexDirection="row"
      width="100%"
      height={1}
      maxHeight={1}
      overflow="hidden"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={bgColor}
    >
      <text content={icon} fg={iconColor} selectable={false} truncate />
      <text content=" " selectable={false} truncate />
      <text
        content={fileLabel}
        fg={nameColor}
        attributes={props.isActive ? 1 : 0}
        selectable={false}
        flexGrow={1}
        flexShrink={1}
        truncate
      />
    </box>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Header(props: { viewMode: ViewMode; baseLabel: string | null; theme: Theme }) {
  const { viewMode, baseLabel, theme } = props;

  const title = viewMode === "staging" ? "Staging" : "Compare";

  return (
    <box flexDirection="row" justifyContent="space-between" paddingBottom={1} paddingX={1}>
      <text
        content={title}
        fg={viewMode === "compare" ? theme.accent : theme.text}
        attributes={1}
        selectable={false}
      />

      {viewMode === "compare" && baseLabel && (
        <text content={baseLabel} fg={theme.textMuted} selectable={false} />
      )}
    </box>
  );
}

function ErrorMessage(props: { error: string; theme: Theme }) {
  return (
    <box paddingLeft={1}>
      <text content={props.error} fg={props.theme.error} selectable={false} />
    </box>
  );
}

function EmptyState(props: { viewMode: ViewMode; baseLabel: string | null; theme: Theme }) {
  const { viewMode, baseLabel, theme } = props;

  const message =
    viewMode === "staging" ? "Working tree clean" : `No changes vs ${baseLabel ?? "base"}`;

  return (
    <box paddingLeft={1}>
      <text content={message} fg={theme.textMuted} selectable={false} />
    </box>
  );
}

function getRowKey(row: SidebarRow): string | null {
  if (row.kind !== "file") return null;

  return buildFileKey(row.section, row.file.path);
}

// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------

export function Sidebar(props: SidebarProps) {
  const {
    theme,
    status,
    error,
    selectedFileKey,
    focusedFileKey,
    selectFile,
    viewMode,
    compareState,
    isOpen,
    width,
  } = props;

  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const staged = getStagedFiles(status);
  const changes = getChangeFiles(status);
  const compareFiles = getCompareFiles(compareState);
  const isEmpty = isEmptyRepo(status);
  const activeFileKey = selectedFileKey ?? focusedFileKey;
  const rows = useMemo(
    () => buildSidebarRows({ theme, viewMode, staged, changes, compareFiles, isEmpty }),
    [theme, viewMode, staged, changes, compareFiles, isEmpty],
  );

  const activeRowIndex = useMemo(
    () => rows.findIndex((row) => getRowKey(row) === activeFileKey),
    [rows, activeFileKey],
  );

  useLayoutEffect(() => {
    if (props.selectionSource !== "keyboard") return;
    if (activeRowIndex < 0 || viewportHeight <= 0) return;
    if (!scrollRef.current) return;

    const current = scrollRef.current.scrollTop;

    let next = current;
    const rowTop = activeRowIndex;
    const rowBottom = rowTop + 1;
    const viewportBottom = current + viewportHeight;

    if (rowTop < current) {
      next = rowTop;
    } else if (rowBottom > viewportBottom) {
      next = rowBottom - viewportHeight;
    }

    const value = next === current ? current : next;
    if (scrollRef.current) scrollRef.current.scrollTop = value;
  }, [activeRowIndex, props.selectionSource, viewportHeight]);

  if (!isOpen) return null;

  return (
    <box
      backgroundColor={theme.surface}
      width={width}
      height="100%"
      flexDirection="column"
      paddingX={1}
    >
      <Header viewMode={viewMode} baseLabel={compareState?.baseLabel ?? null} theme={theme} />

      <scrollbox
        ref={scrollRef}
        scrollTop={scrollTop}
        viewportCulling
        flexGrow={1}
        onSizeChange={() => {
          if (!scrollRef.current) return;
          setViewportHeight(scrollRef.current.height);
        }}
        onMouseScroll={() => {
          if (!scrollRef.current) return;
          setScrollTop(scrollRef.current.scrollTop);
        }}
        scrollbarOptions={{
          trackOptions: { backgroundColor: theme.surface },
        }}
      >
        {error ? <ErrorMessage error={error} theme={theme} /> : null}

        {rows.length === 0 ? (
          <EmptyState
            viewMode={viewMode}
            baseLabel={compareState?.baseLabel ?? null}
            theme={theme}
          />
        ) : (
          rows.map((row) => {
            if (row.kind === "section") {
              return (
                <SidebarSectionHeader
                  key={row.key}
                  label={row.label}
                  count={row.count}
                  countColor={row.countColor}
                  theme={theme}
                />
              );
            }

            const key = buildFileKey(row.section, row.file.path);
            const isActive = activeFileKey === key;

            return (
              <SidebarRowView
                key={key}
                file={row.file}
                section={row.section}
                theme={theme}
                isActive={isActive}
                onSelect={() => selectFile(row.file.path, row.section)}
              />
            );
          })
        )}
      </scrollbox>
    </box>
  );
}
