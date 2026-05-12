import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { parseBranches } from ".";

describe("git branch parser", () => {
  test("parses local and remote branches", () => {
    const parsed = parseBranches(
      [
        "\x1erefs/heads/main",
        "main",
        "mainsha",
        "origin/main",
        "*",
        "2026-05-01T10:00:00Z",
        "feat: main",
        "Ada",
        "<ada@example.com>",
        "\x1erefs/remotes/origin/feature",
        "origin/feature",
        "featuresha",
        "",
        "",
        "2026-05-02T10:00:00Z",
        "feat: feature",
        "Grace",
        "<grace@example.com>",
      ].join("\0"),
    );

    expect(Result.isOk(parsed)).toBe(true);
    if (Result.isError(parsed)) return;

    expect(parsed.value).toEqual([
      {
        ref: "refs/heads/main",
        name: "main",
        scope: "local",
        current: true,
        commitRef: "mainsha",
        upstream: "origin/main",
        committedAt: "2026-05-01T10:00:00Z",
        lastCommitTitle: "feat: main",
        authorName: "Ada",
        authorEmail: "ada@example.com",
      },
      {
        ref: "refs/remotes/origin/feature",
        name: "origin/feature",
        scope: "remote",
        current: false,
        commitRef: "featuresha",
        committedAt: "2026-05-02T10:00:00Z",
        lastCommitTitle: "feat: feature",
        authorName: "Grace",
        authorEmail: "grace@example.com",
      },
    ]);
  });
});
