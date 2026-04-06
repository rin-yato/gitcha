import type { CompareTarget, GitRepoStatus, GitStatusFile } from "../../git";
import type { GitClient } from "./session";

type FakeBranch = {
  name: string;
  base?: string;
  files: GitStatusFile[];
};

type FakeProject = {
  currentBranch: string;
  branches: Record<string, FakeBranch>;
  compareFiles: Record<string, GitStatusFile[]>;
  stagingDiffs: Record<string, string>;
  fileDiffs: Record<string, string>;
  fileVersions: Record<string, string>;
  status: GitRepoStatus;
  defaultTarget: CompareTarget;
  commits: string[];
};

function file(
  path: string,
  indexStatus: GitStatusFile["indexStatus"],
  workingTreeStatus: GitStatusFile["workingTreeStatus"],
): GitStatusFile {
  return { path, indexStatus, workingTreeStatus };
}

function buildStatus(
  branch: string,
  staged: GitStatusFile[],
  changes: GitStatusFile[],
): GitRepoStatus {
  return {
    branch,
    upstream: undefined,
    aheadCount: 1,
    behindCount: 0,
    files: {
      staged,
      changes,
      untracked: [],
      conflicted: [],
    },
    totalFiles: staged.length + changes.length,
    isRepo: true,
  };
}

function cloneFile(file: GitStatusFile): GitStatusFile {
  return { ...file };
}

function cloneStatus(status: GitRepoStatus): GitRepoStatus {
  return {
    ...status,
    files: {
      staged: status.files.staged.map(cloneFile),
      changes: status.files.changes.map(cloneFile),
      untracked: status.files.untracked.map(cloneFile),
      conflicted: status.files.conflicted.map(cloneFile),
    },
  };
}

function createFakeProject(): FakeProject {
  const compareFiles = [
    file("src/app.ts", " ", "M"),
    file("src/ui/panel.renamed.tsx", "R", " "),
  ];

  const featureFiles = [
    file("src/app.ts", " ", "M"),
    file("src/ui/panel.renamed.tsx", "R", " "),
    file("src/new-feature.ts", "A", " "),
  ];

  return {
    currentBranch: "feat/b",
    branches: {
      master: { name: "master", files: [file("README.md", " ", "M")] },
      "feat/a": {
        name: "feat/a",
        base: "master",
        files: compareFiles,
      },
      "feat/b": {
        name: "feat/b",
        base: "feat/a",
        files: featureFiles,
      },
    },
    compareFiles: {
      "feat/a": compareFiles,
      master: [
        file("src/app.ts", " ", "M"),
        file("src/ui/panel.renamed.tsx", "R", " "),
        file("src/new-feature.ts", "A", " "),
      ],
    },
    stagingDiffs: {
      "src/app.ts": `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,1 @@
-console.log("hello from feat/a")
+console.log("hello from feat/b")`,
      "src/ui/panel.tsx": `diff --git a/src/ui/panel.tsx b/src/ui/panel.tsx
index 1111111..2222222 100644
--- a/src/ui/panel.tsx
+++ b/src/ui/panel.tsx
@@ -1,1 +1,1 @@
-export function Panel() { return <box>feat/a</box>; }
+export function Panel() { return <box>feat/b</box>; }`,
      "src/ui/panel.renamed.tsx": `diff --git a/src/ui/panel.tsx b/src/ui/panel.renamed.tsx
similarity index 95%
rename from src/ui/panel.tsx
rename to src/ui/panel.renamed.tsx
@@ -1,1 +1,1 @@
-export function Panel() { return <box>feat/a</box>; }
+export function Panel() { return <box>feat/b</box>; }`,
      "src/new-feature.ts": `diff --git a/src/new-feature.ts b/src/new-feature.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new-feature.ts
@@ -0,0 +1 @@
+export const feature = "feat/b";`,
    },
    fileDiffs: {
      "feat/a::src/app.ts": `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,1 @@
-console.log("hello from feat/a")
+console.log("hello from feat/b")`,
      "feat/a::src/ui/panel.renamed.tsx": `diff --git a/src/ui/panel.tsx b/src/ui/panel.renamed.tsx
similarity index 95%
rename from src/ui/panel.tsx
rename to src/ui/panel.renamed.tsx
@@ -1,1 +1,1 @@
-export function Panel() { return <box>feat/a</box>; }
+export function Panel() { return <box>feat/b</box>; }`,
      "master::src/app.ts": `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,1 @@
-console.log("hello from master")
+console.log("hello from feat/b")`,
      "master::src/ui/panel.renamed.tsx": `diff --git a/src/ui/panel.tsx b/src/ui/panel.renamed.tsx
similarity index 95%
rename from src/ui/panel.tsx
rename to src/ui/panel.renamed.tsx
@@ -1,1 +1,1 @@
-export function Panel() { return <box>master</box>; }
+export function Panel() { return <box>feat/b</box>; }`,
      "master::src/new-feature.ts": `diff --git a/src/new-feature.ts b/src/new-feature.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new-feature.ts
@@ -0,0 +1 @@
+export const feature = "feat/b";`,
    },
    fileVersions: {
      "HEAD:src/app.ts": 'console.log("hello from feat/a")',
      ":0:src/app.ts": 'console.log("hello from feat/b")',
      "HEAD:src/ui/panel.renamed.tsx": "export function Panel() { return <box>feat/a</box>; }",
      ":0:src/ui/panel.renamed.tsx": "export function Panel() { return <box>feat/b</box>; }",
      "HEAD:src/new-feature.ts": "",
      ":0:src/new-feature.ts": 'export const feature = "feat/b";',
    },
    status: buildStatus(
      "feat/b",
      [file("docs/README.md", "A", " ")],
      [file("src/app.ts", " ", "M"), file("src/ui/panel.renamed.tsx", "R", " ")],
    ),
    defaultTarget: { ref: "feat/a", label: "feat/a" },
    commits: ["deadbee feat(b): add fake compare scenario", "beef123 feat(a): base branch"],
  };
}

export function createFakeGitClient(project = createFakeProject()): GitClient {
  const status = cloneStatus(project.status);

  const persist = () => {
    project.status = cloneStatus(status);
  };

  const moveFile = (source: GitStatusFile[], target: GitStatusFile[], filePath: string) => {
    const index = source.findIndex(
      (file) => file.path === filePath || file.originalPath === filePath,
    );
    if (index === -1) return false;

    const [file] = source.splice(index, 1);
    if (!file) return false;
    target.push(cloneFile(file));
    return true;
  };

  return {
    getRepoStatus: async () => cloneStatus(status),
    getRecentCommits: async () => project.commits,
    getLocalBranches: async () => Object.keys(project.branches).sort(),
    getCompareTarget: async () => project.defaultTarget,
    getBranchDiffFiles: async (ref) => project.compareFiles[ref] ?? [],
    getFileVersion: async (ref, path) => {
      return project.fileVersions[`${ref}:${path}`] ?? null;
    },
    getMergeBase: async (baseRef) => {
      return project.branches[project.currentBranch]?.base ?? baseRef;
    },
    loadDiffSource: async (filePath, section, compareBaseRef) => {
      if (section === "compare" && compareBaseRef) {
        const diffKey = `${compareBaseRef}::${filePath}`;
        const diff = project.fileDiffs[diffKey];
        return {
          baseContent: diff ? `base content of ${filePath}` : null,
          currentContent: diff ? `current content of ${filePath}` : null,
        };
      }

      if (section === "staged") {
        return {
          baseContent: project.fileVersions[`HEAD:${filePath}`] ?? null,
          currentContent: project.fileVersions[`:0:${filePath}`] ?? null,
        };
      }

      return {
        baseContent: project.fileVersions[`:0:${filePath}`] ?? null,
        currentContent: `working tree content of ${filePath}`,
      };
    },
    stageFile: async (filePath) => {
      if (
        moveFile(status.files.changes, status.files.staged, filePath) ||
        moveFile(status.files.untracked, status.files.staged, filePath)
      ) {
        persist();
      }
    },
    unstageFile: async (filePath) => {
      if (moveFile(status.files.staged, status.files.changes, filePath)) {
        persist();
      }
    },
    discardChanges: async (filePath) => {
      if (
        moveFile(status.files.staged, status.files.changes, filePath) ||
        moveFile(status.files.changes, status.files.untracked, filePath) ||
        moveFile(status.files.untracked, status.files.changes, filePath)
      ) {
        persist();
      }
    },
    commitChanges: async () => {
      status.files.staged = [];
      status.aheadCount += 1;
      persist();
    },
    pushChanges: async () => {},
    pullChanges: async () => {},
  };
}
