/**
 * Tree-sitter parser configurations for additional language support.
 *
 * Based on the pattern from opencode upstream.
 * Parsers are loaded on-demand and cached locally.
 *
 * Note: markdown, javascript, and typescript are built-in to @opentui/core
 * and don't need to be registered here.
 */

import type { FiletypeParserOptions } from "@opentui/core";

// Re-export the type from core for compatibility
export type ParserConfig = FiletypeParserOptions;

const NVIM_QUERIES =
  "https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries";

export const parsers: FiletypeParserOptions[] = [
  // Systems languages
  {
    filetype: "python",
    wasm: "https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.23.6/tree-sitter-python.wasm",
    queries: {
      highlights: [
        "https://github.com/tree-sitter/tree-sitter-python/raw/refs/heads/master/queries/highlights.scm",
      ],
    },
  },
  {
    filetype: "rust",
    wasm: "https://github.com/tree-sitter/tree-sitter-rust/releases/download/v0.24.0/tree-sitter-rust.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/rust/highlights.scm`],
    },
  },
  {
    filetype: "go",
    wasm: "https://github.com/tree-sitter/tree-sitter-go/releases/download/v0.25.0/tree-sitter-go.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/go/highlights.scm`],
    },
  },
  {
    filetype: "cpp",
    wasm: "https://github.com/tree-sitter/tree-sitter-cpp/releases/download/v0.23.4/tree-sitter-cpp.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/cpp/highlights.scm`],
    },
  },
  {
    filetype: "c",
    wasm: "https://github.com/tree-sitter/tree-sitter-c/releases/download/v0.24.1/tree-sitter-c.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/c/highlights.scm`],
    },
  },

  // JVM languages
  {
    filetype: "java",
    wasm: "https://github.com/tree-sitter/tree-sitter-java/releases/download/v0.23.5/tree-sitter-java.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/java/highlights.scm`],
    },
  },
  {
    filetype: "kotlin",
    wasm: "https://github.com/fwcd/tree-sitter-kotlin/releases/download/0.3.8/tree-sitter-kotlin.wasm",
    queries: {
      highlights: [
        "https://raw.githubusercontent.com/fwcd/tree-sitter-kotlin/0.3.8/queries/highlights.scm",
      ],
    },
  },
  {
    filetype: "scala",
    wasm: "https://github.com/tree-sitter/tree-sitter-scala/releases/download/v0.24.0/tree-sitter-scala.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/scala/highlights.scm`],
    },
  },

  // .NET
  {
    filetype: "csharp",
    wasm: "https://github.com/tree-sitter/tree-sitter-c-sharp/releases/download/v0.23.1/tree-sitter-c_sharp.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/c_sharp/highlights.scm`],
    },
  },

  // Shell scripting
  {
    filetype: "bash",
    wasm: "https://github.com/tree-sitter/tree-sitter-bash/releases/download/v0.25.0/tree-sitter-bash.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/bash/highlights.scm`],
    },
  },

  // Web/Frontend
  {
    filetype: "html",
    wasm: "https://github.com/tree-sitter/tree-sitter-html/releases/download/v0.23.2/tree-sitter-html.wasm",
    queries: {
      highlights: [
        "https://github.com/tree-sitter/tree-sitter-html/raw/refs/heads/master/queries/highlights.scm",
      ],
    },
  },
  {
    filetype: "css",
    wasm: "https://github.com/tree-sitter/tree-sitter-css/releases/download/v0.25.0/tree-sitter-css.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/css/highlights.scm`],
    },
  },
  {
    filetype: "scss",
    wasm: "https://github.com/tree-sitter/tree-sitter-scss/releases/download/v0.24.3/tree-sitter-scss.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/scss/highlights.scm`],
    },
  },

  // Ruby & PHP
  {
    filetype: "ruby",
    wasm: "https://github.com/tree-sitter/tree-sitter-ruby/releases/download/v0.23.1/tree-sitter-ruby.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/ruby/highlights.scm`],
    },
  },
  {
    filetype: "php",
    wasm: "https://github.com/tree-sitter/tree-sitter-php/releases/download/v0.24.2/tree-sitter-php.wasm",
    queries: {
      highlights: [
        "https://github.com/tree-sitter/tree-sitter-php/raw/refs/heads/master/queries/highlights.scm",
      ],
    },
  },

  // Data/Config formats
  {
    filetype: "json",
    wasm: "https://github.com/tree-sitter/tree-sitter-json/releases/download/v0.24.8/tree-sitter-json.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/json/highlights.scm`],
    },
  },
  {
    filetype: "yaml",
    wasm: "https://github.com/tree-sitter-grammars/tree-sitter-yaml/releases/download/v0.7.2/tree-sitter-yaml.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/yaml/highlights.scm`],
    },
  },
  {
    filetype: "toml",
    wasm: "https://github.com/tree-sitter-grammars/tree-sitter-toml/releases/download/v0.7.0/tree-sitter-toml.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/toml/highlights.scm`],
    },
  },
  {
    filetype: "hcl",
    wasm: "https://github.com/tree-sitter-grammars/tree-sitter-hcl/releases/download/v1.2.0/tree-sitter-hcl.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/hcl/highlights.scm`],
    },
  },

  // Functional languages
  {
    filetype: "haskell",
    wasm: "https://github.com/tree-sitter/tree-sitter-haskell/releases/download/v0.23.1/tree-sitter-haskell.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/haskell/highlights.scm`],
    },
  },
  {
    filetype: "ocaml",
    wasm: "https://github.com/tree-sitter/tree-sitter-ocaml/releases/download/v0.24.2/tree-sitter-ocaml.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/ocaml/highlights.scm`],
    },
  },
  {
    filetype: "clojure",
    wasm: "https://github.com/anomalyco/tree-sitter-clojure/releases/download/v0.0.1/tree-sitter-clojure.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/clojure/highlights.scm`],
    },
  },

  // Other languages
  {
    filetype: "swift",
    wasm: "https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.1/tree-sitter-swift.wasm",
    queries: {
      highlights: [
        "https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/main/queries/highlights.scm",
      ],
    },
  },
  {
    filetype: "lua",
    wasm: "https://github.com/tree-sitter-grammars/tree-sitter-lua/releases/download/v0.5.0/tree-sitter-lua.wasm",
    queries: {
      highlights: [
        "https://raw.githubusercontent.com/tree-sitter-grammars/tree-sitter-lua/v0.5.0/queries/highlights.scm",
      ],
    },
  },
  {
    filetype: "julia",
    wasm: "https://github.com/tree-sitter/tree-sitter-julia/releases/download/v0.23.1/tree-sitter-julia.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/julia/highlights.scm`],
    },
  },
  {
    filetype: "nix",
    wasm: "https://github.com/ast-grep/ast-grep.github.io/raw/40b84530640aa83a0d34a20a2b0623d7b8e5ea97/website/public/parsers/tree-sitter-nix.wasm",
    queries: {
      highlights: [`${NVIM_QUERIES}/nix/highlights.scm`],
    },
  },
];
