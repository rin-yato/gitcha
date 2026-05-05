export * from "./file-item";
export * from "./file-list";
export * from "./types";
export * from "./utils";

import type { ScrollBoxRenderable } from "@opentui/core";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { SelectionSource } from "@/context/selection";
import { buildFileKey, type FileSection, parseFileKey } from "@/context/selection/utils";
import type { Theme } from "@/context/theme/provider";
import type { ViewMode } from "@/context/view";

import type {
  CompareState,
  FileTreeNode,
  FileTreeSnapshot,
  GitRepoStatus,
  GitStatusFile,
} from "@/lib/git";

import {
  buildDirKey,
  getAncestorDirs,
  getFileStatus,
  getStatusColor,
  getStatusIcon,
  splitPath,
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
  fileTrees: {
    staged: FileTreeSnapshot;
    changes: FileTreeSnapshot;
    compare: FileTreeSnapshot;
  };
  isOpen: boolean;
  width: number;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isEmptyRepo(status: GitRepoStatus | null): boolean {
  if (!status?.isRepo) return true;
  return status.totalFiles === 0;
}

type SidebarRow =
  | { kind: "section"; key: string; label: string; count: number; countColor: string }
  | { kind: "file"; key: string; file: GitStatusFile; section: FileSection; depth: number }
  | {
      kind: "dir";
      key: string;
      section: FileSection;
      path: string;
      label: string;
      depth: number;
      isCollapsed: boolean;
    };

function getFlattenedDir(node: FileTreeNode): { node: FileTreeNode; label: string } {
  let current = node;
  let label = node.name;

  while (current.children.length === 1) {
    const child = current.children[0];
    if (!child?.isDirectory) break;

    current = child;
    label = `${label}/${current.name}`;
  }

  return { node: current, label };
}

function flattenTreeNodes(
  nodes: FileTreeNode[],
  section: FileSection,
  depth: number,
  collapsedDirs: Set<string>,
): SidebarRow[] {
  const rows: SidebarRow[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      const flattened = getFlattenedDir(node);
      const dirKey = buildDirKey(section, flattened.node.path);
      const isCollapsed = collapsedDirs.has(dirKey);
      rows.push({
        kind: "dir",
        key: `dir:${dirKey}`,
        section,
        path: flattened.node.path,
        label: flattened.label,
        depth,
        isCollapsed,
      });
      if (!isCollapsed) {
        rows.push(
          ...flattenTreeNodes(flattened.node.children, section, depth + 1, collapsedDirs),
        );
      }
    } else if (node.fileInfo) {
      rows.push({
        kind: "file",
        key: buildFileKey(section, node.path),
        file: node.fileInfo,
        section,
        depth,
      });
    }
  }
  return rows;
}

function buildSidebarRows(args: {
  theme: Theme;
  viewMode: ViewMode;
  stagedTree: FileTreeNode;
  changesTree: FileTreeNode;
  compareTree: FileTreeNode;
  stagedCount: number;
  changesCount: number;
  compareCount: number;
  isEmpty: boolean;
  collapsedDirs: Set<string>;
}): SidebarRow[] {
  const {
    theme,
    viewMode,
    stagedTree,
    changesTree,
    compareTree,
    stagedCount,
    changesCount,
    compareCount,
    isEmpty,
    collapsedDirs,
  } = args;
  if (viewMode === "compare") {
    if (compareCount === 0) {
      return [];
    }

    return [
      {
        kind: "section",
        key: "section:compare",
        label: "Changes",
        count: compareCount,
        countColor: theme.modified,
      },
      ...flattenTreeNodes(compareTree.children, "compare", 0, collapsedDirs),
    ];
  }

  if (isEmpty) return [];

  return [
    {
      kind: "section",
      key: "section:staged",
      label: "Staged",
      count: stagedCount,
      countColor: theme.added,
    },
    ...flattenTreeNodes(stagedTree.children, "staged", 0, collapsedDirs),
    {
      kind: "section",
      key: "section:changes",
      label: "Changes",
      count: changesCount,
      countColor: theme.modified,
    },
    ...flattenTreeNodes(changesTree.children, "changes", 0, collapsedDirs),
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

function SidebarDirRow(props: {
  label: string;
  depth: number;
  isCollapsed: boolean;
  onToggle: () => void;
  theme: Theme;
}) {
  const indent = 1 + props.depth * 2;
  const icon = props.isCollapsed ? "▶" : "▼";

  return (
    <box
      onMouseUp={props.onToggle}
      flexDirection="row"
      width="100%"
      height={1}
      maxHeight={1}
      overflow="hidden"
      paddingLeft={indent}
      paddingRight={1}
    >
      <text content={icon} fg={props.theme.textMuted} selectable={false} />
      <text content=" " selectable={false} />
      <text
        content={props.label}
        fg={props.theme.textMuted}
        selectable={false}
        flexGrow={1}
        flexShrink={1}
        truncate
      />
    </box>
  );
}

function SidebarRowView(props: {
  file: GitStatusFile;
  section: FileSection;
  theme: Theme;
  isActive: boolean;
  depth: number;
  onSelect: () => void;
}) {
  const status = getFileStatus(props.file);
  const icon = getStatusIcon(status);
  const statusColor = getStatusColor(status, props.theme);

  const bgColor = props.isActive ? props.theme.accent : undefined;
  const nameColor = props.isActive ? props.theme.background : statusColor;
  const iconColor = props.isActive ? props.theme.background : statusColor;
  const fileLabel = splitPath(props.file.path).name;
  const indent = 1 + props.depth * 2;

  return (
    <box
      id={buildFileKey(props.section, props.file.path)}
      onMouseUp={props.onSelect}
      flexDirection="row"
      width="100%"
      height={1}
      maxHeight={1}
      overflow="hidden"
      paddingLeft={indent}
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
    fileTrees,
    isOpen,
    width,
  } = props;

  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const [_scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const previousActiveFileKeyRef = useRef<string | null>(null);

  const isEmpty = isEmptyRepo(status);
  const activeFileKey = selectedFileKey ?? focusedFileKey;
  const treeSnapshots = fileTrees;

  const toggleDir = useCallback((section: FileSection, path: string) => {
    const dirKey = buildDirKey(section, path);
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirKey)) {
        next.delete(dirKey);
      } else {
        next.add(dirKey);
      }
      return next;
    });
  }, []);

  const rows = useMemo(
    () =>
      buildSidebarRows({
        theme,
        viewMode,
        stagedTree: treeSnapshots.staged.tree,
        changesTree: treeSnapshots.changes.tree,
        compareTree: treeSnapshots.compare.tree,
        stagedCount: treeSnapshots.staged.orderedFiles.length,
        changesCount: treeSnapshots.changes.orderedFiles.length,
        compareCount: treeSnapshots.compare.orderedFiles.length,
        isEmpty,
        collapsedDirs,
      }),
    [theme, viewMode, treeSnapshots, isEmpty, collapsedDirs],
  );

  const activeRowIndex = useMemo(
    () => rows.findIndex((row) => getRowKey(row) === activeFileKey),
    [rows, activeFileKey],
  );

  // Auto-expand collapsed ancestor directories only when the active file changes.
  // This keeps manual collapse sticky while a file remains selected inside it.
  useLayoutEffect(() => {
    if (!activeFileKey) return;
    const previousActiveFileKey = previousActiveFileKeyRef.current;
    previousActiveFileKeyRef.current = activeFileKey;

    if (previousActiveFileKey === activeFileKey) return;
    if (activeRowIndex >= 0) return;
    const parsed = parseFileKey(activeFileKey);
    if (!parsed) return;
    const ancestors = getAncestorDirs(parsed.path);
    if (ancestors.length === 0) return;
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      for (const dir of ancestors) next.delete(dir);
      return next;
    });
  }, [activeFileKey, activeRowIndex]);

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
          trackOptions: {
            foregroundColor: `${theme.textMuted}80`,
            backgroundColor: "transparent",
          },
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

            if (row.kind === "dir") {
              return (
                <SidebarDirRow
                  key={row.key}
                  label={row.label}
                  depth={row.depth}
                  isCollapsed={row.isCollapsed}
                  onToggle={() => toggleDir(row.section, row.path)}
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
                depth={row.depth}
                onSelect={() => selectFile(row.file.path, row.section)}
              />
            );
          })
        )}
      </scrollbox>
    </box>
  );
}
