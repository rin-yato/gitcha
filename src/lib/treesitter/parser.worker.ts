import * as path from "path";
import { Parser } from "web-tree-sitter";

const originalInit = Parser.init.bind(Parser);

/**
 * OpenTUI's worker passes wasm paths through web-tree-sitter as relative filenames.
 * Bun resolves those from the current process directory, so rewrite them against the
 * bundled worker module URL before the upstream worker boots.
 */
Parser.init = async (options: Parameters<typeof Parser.init>[0] = {}) => {
  const nextOptions = {
    ...options,
    locateFile(file: string, basePath: string) {
      const resolved = options.locateFile?.(file, basePath) ?? file;

      if (typeof resolved !== "string") {
        return resolved;
      }

      if (resolved.startsWith("data:") || resolved.startsWith("file:")) {
        return resolved;
      }

      if (path.isAbsolute(resolved)) {
        return resolved;
      }

      return new URL(resolved, import.meta.url).href;
    },
  };

  return originalInit(nextOptions);
};

// @ts-expect-error
await import("../../../node_modules/@opentui/core/parser.worker.js");
