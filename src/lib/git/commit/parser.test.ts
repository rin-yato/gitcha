import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { parseCommits } from ".";

describe("git commit parser", () => {
  test("parses rich commit records", () => {
    const parsed = parseCommits(
      [
        "\x1eabcdef123456",
        "abcdef1",
        "feat: add review",
        "Body line\n\nMore detail",
        "Ada",
        "ada@example.com",
        "2026-05-01T10:00:00Z",
        "2026-05-01T10:01:00Z",
        "parent1 parent2",
        "HEAD -> main, origin/main\n",
      ].join("\0"),
    );

    expect(Result.isOk(parsed)).toBe(true);
    if (Result.isError(parsed)) return;

    expect(parsed.value).toEqual([
      {
        ref: "abcdef123456",
        shortRef: "abcdef1",
        title: "feat: add review",
        description: "Body line\n\nMore detail",
        message: "feat: add review\n\nBody line\n\nMore detail",
        authorName: "Ada",
        authorEmail: "ada@example.com",
        authoredAt: "2026-05-01T10:00:00Z",
        committedAt: "2026-05-01T10:01:00Z",
        parentRefs: ["parent1", "parent2"],
        origin: "main",
      },
    ]);
  });

  test("returns a parse error for malformed commit records", () => {
    const parsed = parseCommits("\x1eabc\0short\0subject");

    expect(Result.isError(parsed)).toBe(true);
    if (Result.isError(parsed)) expect(parsed.error.message).toContain("Malformed");
  });
});
