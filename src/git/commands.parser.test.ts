import { getBranchDiffFiles } from "./commands";
import { describe, expect, test } from "bun:test";

describe("getBranchDiffFiles shape", () => {
  test("returns file records with status fields", async () => {
    const files = await getBranchDiffFiles("HEAD");
    for (const file of files) {
      expect(file).toHaveProperty("path");
      expect(file).toHaveProperty("indexStatus");
      expect(file).toHaveProperty("workingTreeStatus");
    }
  });
});
