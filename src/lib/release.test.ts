import { describe, expect, test } from "bun:test";

import { createLatestReleaseLookup } from "./release";

describe("createLatestReleaseLookup", () => {
  test("returns the latest release tag", async () => {
    const lookup = createLatestReleaseLookup(
      async () => new Response(JSON.stringify({ tag_name: "v0.1.7" }), { status: 200 }),
    );

    await expect(lookup()).resolves.toBe("v0.1.7");
  });
});
