import { createFakeGitClient } from "./fake-client";
import { describe, expect, test } from "bun:test";

describe("fake git project", () => {
  test("exposes realistic repo state", async () => {
    const backend = createFakeGitClient();
    const status = await backend.getRepoStatus();

    expect(status.branch).toBe("feat/b");
    expect(status.files.staged.map((file: { path: string }) => file.path)).toContain(
      "docs/README.md",
    );
    expect(status.files.changes.map((file: { path: string }) => file.path)).toContain(
      "src/app.ts",
    );
    expect(status.files.changes.map((file: { path: string }) => file.path)).toContain(
      "src/ui/panel.renamed.tsx",
    );
  });

  test("supports staging, unstaging, and discard semantics", async () => {
    const backend = createFakeGitClient();

    await backend.stageFile("src/app.ts");
    let status = await backend.getRepoStatus();
    expect(status.files.staged.map((file: { path: string }) => file.path)).toContain(
      "src/app.ts",
    );

    await backend.unstageFile("src/app.ts");
    status = await backend.getRepoStatus();
    expect(status.files.staged.map((file: { path: string }) => file.path)).not.toContain(
      "src/app.ts",
    );
    expect(status.files.changes.map((file: { path: string }) => file.path)).toContain(
      "src/app.ts",
    );

    await backend.discardChanges("src/app.ts");
    status = await backend.getRepoStatus();
    expect(status.files.changes.map((file: { path: string }) => file.path)).not.toContain(
      "src/app.ts",
    );
  });

  test("keeps compare data for parent branches and renamed files", async () => {
    const backend = createFakeGitClient();

    expect(await backend.getCompareTarget()).toEqual({ ref: "feat/a", label: "feat/a" });
    expect(
      (await backend.getBranchDiffFiles("feat/a")).map((file: { path: string }) => file.path),
    ).toContain("src/ui/panel.renamed.tsx");
  });
});
