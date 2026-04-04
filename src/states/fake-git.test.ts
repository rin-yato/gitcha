import { createFakeGitBackend } from "./fake-git";
import { describe, expect, test } from "bun:test";

describe("fake git project", () => {
  test("exposes realistic repo state", () => {
    const backend = createFakeGitBackend();
    const status = backend.getRepoStatus();

    expect(status.branch).toBe("feat/b");
    expect(status.files.staged.map((file) => file.path)).toContain("docs/README.md");
    expect(status.files.changes.map((file) => file.path)).toContain("src/app.ts");
    expect(status.files.changes.map((file) => file.path)).toContain("src/ui/panel.renamed.tsx");
  });

  test("supports staging, unstaging, and discard semantics", () => {
    const backend = createFakeGitBackend();

    backend.stageFile("src/app.ts");
    let status = backend.getRepoStatus();
    expect(status.files.staged.map((file) => file.path)).toContain("src/app.ts");

    backend.unstageFile("src/app.ts");
    status = backend.getRepoStatus();
    expect(status.files.staged.map((file) => file.path)).not.toContain("src/app.ts");
    expect(status.files.changes.map((file) => file.path)).toContain("src/app.ts");

    backend.discardChanges("src/app.ts");
    status = backend.getRepoStatus();
    expect(status.files.changes.map((file) => file.path)).not.toContain("src/app.ts");
  });

  test("keeps compare data for parent branches and renamed files", () => {
    const backend = createFakeGitBackend();

    expect(backend.getDefaultCompareTarget()).toEqual({ ref: "feat/a", label: "feat/a" });
    expect(backend.getBranchDiffFiles("feat/a").map((file) => file.path)).toContain(
      "src/ui/panel.renamed.tsx",
    );
  });
});
