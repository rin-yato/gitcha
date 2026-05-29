import { createGitScopedFile } from "@/lib/git";
import { buildFileTreeSnapshot } from "@/lib/git/status";
import type {
  CategorizedFiles,
  FileTreeNode,
  GitFileSection,
  GitRepoStatus,
  GitScopedFile,
  GitStatusFile,
} from "@/lib/git/types";

import { createSidebarDirectoryKey } from "@/context/sidebar";

export interface SidebarSectionModel {
  title: string;
  kind: GitFileSection;
  files: GitStatusFile[];
  count: number;
}

export type SidebarListMode = "flat" | "tree";

export type SidebarRow =
  | {
      kind: "directory";
      section: GitFileSection;
      key: string;
      name: string;
      path: string;
      depth: number;
      isCollapsed: boolean;
    }
  | {
      kind: "file";
      section: GitFileSection;
      name: string;
      path: string;
      depth: number;
      file: GitStatusFile;
    };

export interface SidebarSectionViewModel extends SidebarSectionModel {
  rows: SidebarRow[];
}

export function createSidebarSections(status: GitRepoStatus | null): SidebarSectionModel[] {
  if (!status?.files) return [];

  const changesFiles = [...status.files.changes, ...status.files.untracked];

  return [
    {
      title: "Conflicts",
      kind: "conflicts",
      files: status.files.conflicted,
      count: status.files.conflicted.length,
    },
    {
      title: "Staged",
      kind: "staged",
      files: status.files.staged,
      count: status.files.staged.length,
    },
    {
      title: "Changes",
      kind: "changes",
      files: changesFiles,
      count: changesFiles.length,
    },
  ];
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function flattenTreeChain(node: FileTreeNode): { node: FileTreeNode; label: string } {
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

function buildTreeRows(
  section: GitFileSection,
  nodes: FileTreeNode[],
  collapsedDirectoryKeys: ReadonlySet<string>,
  depth = 0,
): SidebarRow[] {
  return nodes.flatMap((node) => {
    if (node.isDirectory) {
      const flattened = flattenTreeChain(node);
      const key = createSidebarDirectoryKey(section, flattened.node.path);
      const isCollapsed = collapsedDirectoryKeys.has(key);

      return [
        {
          kind: "directory",
          section,
          key,
          name: flattened.label,
          path: flattened.node.path,
          depth,
          isCollapsed,
        },
        ...(isCollapsed
          ? []
          : buildTreeRows(section, flattened.node.children, collapsedDirectoryKeys, depth + 1)),
      ];
    }

    if (!node.fileInfo) return [];

    return [
      {
        kind: "file",
        section,
        name: fileName(node.path),
        path: node.path,
        depth,
        file: node.fileInfo,
      },
    ];
  });
}

function buildFlatRows(section: GitFileSection, files: GitStatusFile[]): SidebarRow[] {
  return files.map((file) => ({
    kind: "file",
    section,
    name: file.path,
    path: file.path,
    depth: 0,
    file,
  }));
}

export function createSidebarSectionViews(
  status: GitRepoStatus | null,
  mode: SidebarListMode = "flat",
  collapsedDirectoryKeys: readonly string[] = [],
): SidebarSectionViewModel[] {
  if (!status?.files) return [];

  const sections = createSidebarSections(status);

  if (mode === "flat") {
    return sections.map((section) => ({
      ...section,
      rows: buildFlatRows(section.kind, section.files),
    }));
  }

  const collapsedDirectoryKeySet = new Set(collapsedDirectoryKeys);

  return sections.map((section) => {
    const snapshot = buildFileTreeSnapshot(section.files);
    return {
      ...section,
      rows: buildTreeRows(section.kind, snapshot.tree.children, collapsedDirectoryKeySet),
    };
  });
}

export function createSidebarRows(
  status: GitRepoStatus | null,
  mode: SidebarListMode = "flat",
  collapsedDirectoryKeys: readonly string[] = [],
): SidebarRow[] {
  return createSidebarSectionViews(status, mode, collapsedDirectoryKeys).flatMap(
    (section) => section.rows,
  );
}

export function collectSidebarFiles(
  status: GitRepoStatus | null,
  mode: SidebarListMode = "flat",
): GitScopedFile[] {
  const sections = createSidebarSections(status);

  if (mode === "tree") {
    return sections.flatMap((section) =>
      buildFileTreeSnapshot(section.files).orderedFiles.map((file) =>
        createGitScopedFile(section.kind, file),
      ),
    );
  }

  return sections.flatMap((section) =>
    section.files.map((file) => createGitScopedFile(section.kind, file)),
  );
}

export function createReviewSections(files: CategorizedFiles | null): SidebarSectionModel[] {
  if (!files) return [];

  const allFiles = [...files.conflicted, ...files.staged, ...files.changes, ...files.untracked];

  if (allFiles.length === 0) return [];

  return [
    {
      title: "Review",
      kind: "review",
      files: allFiles,
      count: allFiles.length,
    },
  ];
}

export function createReviewSectionViews(
  files: CategorizedFiles | null,
  mode: SidebarListMode = "flat",
  collapsedDirectoryKeys: readonly string[] = [],
): SidebarSectionViewModel[] {
  const sections = createReviewSections(files);

  if (mode === "flat") {
    return sections.map((section) => ({
      ...section,
      rows: buildFlatRows(section.kind, section.files),
    }));
  }

  const collapsedDirectoryKeySet = new Set(collapsedDirectoryKeys);

  return sections.map((section) => {
    const snapshot = buildFileTreeSnapshot(section.files);
    return {
      ...section,
      rows: buildTreeRows(section.kind, snapshot.tree.children, collapsedDirectoryKeySet),
    };
  });
}

export function collectReviewFiles(
  files: CategorizedFiles | null,
  mode: SidebarListMode = "flat",
): GitScopedFile[] {
  const sections = createReviewSections(files);

  if (mode === "tree") {
    return sections.flatMap((section) =>
      buildFileTreeSnapshot(section.files).orderedFiles.map((file) =>
        createGitScopedFile(section.kind, file),
      ),
    );
  }

  return sections.flatMap((section) =>
    section.files.map((file) => createGitScopedFile(section.kind, file)),
  );
}
