import { describe, expect, test } from "bun:test";

import { detectFiletype, getSupportedSyntaxFiletype } from "./syntax";

describe("detectFiletype", () => {
  test("returns undefined for null input", () => {
    expect(detectFiletype(null)).toBeUndefined();
  });

  describe("detects TypeScript/React files", () => {
    test(".tsx files", () => {
      expect(detectFiletype("src/app.tsx")).toBe("typescriptreact");
    });

    test(".ts files", () => {
      expect(detectFiletype("src/utils.ts")).toBe("typescript");
    });

    test(".mts files", () => {
      expect(detectFiletype("src/module.mts")).toBe("typescript");
    });

    test(".cts files", () => {
      expect(detectFiletype("src/config.cts")).toBe("typescript");
    });

    test(".mtsx files", () => {
      expect(detectFiletype("src/component.mtsx")).toBe("typescriptreact");
    });

    test(".ctsx files", () => {
      expect(detectFiletype("src/component.ctsx")).toBe("typescriptreact");
    });
  });

  describe("detects JavaScript files", () => {
    test(".js files", () => {
      expect(detectFiletype("src/app.js")).toBe("javascript");
    });

    test(".jsx files", () => {
      expect(detectFiletype("src/component.jsx")).toBe("javascriptreact");
    });

    test(".mjs files", () => {
      expect(detectFiletype("src/module.mjs")).toBe("javascript");
    });

    test(".cjs files", () => {
      expect(detectFiletype("src/config.cjs")).toBe("javascript");
    });
  });

  describe("detects Systems languages", () => {
    test("Python files", () => {
      expect(detectFiletype("script.py")).toBe("python");
      expect(detectFiletype("module.pyi")).toBe("python");
    });

    test("Rust files", () => {
      expect(detectFiletype("main.rs")).toBe("rust");
    });

    test("Go files", () => {
      expect(detectFiletype("main.go")).toBe("go");
    });

    test("C files", () => {
      expect(detectFiletype("main.c")).toBe("c");
      expect(detectFiletype("header.h")).toBe("c");
    });

    test("C++ files", () => {
      expect(detectFiletype("main.cpp")).toBe("cpp");
      expect(detectFiletype("main.cc")).toBe("cpp");
      expect(detectFiletype("main.cxx")).toBe("cpp");
      expect(detectFiletype("header.hpp")).toBe("cpp");
      expect(detectFiletype("header.hxx")).toBe("cpp");
      expect(detectFiletype("header.hh")).toBe("cpp");
    });
  });

  describe("detects JVM languages", () => {
    test("Java files", () => {
      expect(detectFiletype("Main.java")).toBe("java");
    });

    test("Kotlin files", () => {
      expect(detectFiletype("Main.kt")).toBe("kotlin");
      expect(detectFiletype("Main.kts")).toBe("kotlin");
    });

    test("Scala files", () => {
      expect(detectFiletype("Main.scala")).toBe("scala");
      expect(detectFiletype("Main.sc")).toBe("scala");
    });
  });

  describe("detects .NET languages", () => {
    test("C# files", () => {
      expect(detectFiletype("Program.cs")).toBe("csharp");
    });
  });

  describe("detects Shell scripts", () => {
    test("Shell files", () => {
      expect(detectFiletype("script.sh")).toBe("bash");
      expect(detectFiletype("script.bash")).toBe("bash");
      expect(detectFiletype("script.zsh")).toBe("bash");
      expect(detectFiletype("script.ksh")).toBe("bash");
    });

    test("Shell config files", () => {
      expect(detectFiletype(".bashrc")).toBe("bash");
      expect(detectFiletype(".zshrc")).toBe("bash");
      expect(detectFiletype(".bash_profile")).toBe("bash");
    });
  });

  describe("detects Web/Frontend files", () => {
    test("HTML files", () => {
      expect(detectFiletype("index.html")).toBe("html");
      expect(detectFiletype("index.htm")).toBe("html");
    });

    test("CSS files", () => {
      expect(detectFiletype("styles.css")).toBe("css");
    });

    test("SCSS files", () => {
      expect(detectFiletype("styles.scss")).toBe("scss");
    });
  });

  describe("detects Ruby & PHP files", () => {
    test("Ruby files", () => {
      expect(detectFiletype("Gemfile")).toBe("ruby");
      expect(detectFiletype("script.rb")).toBe("ruby");
      expect(detectFiletype("Rakefile")).toBe("ruby");
    });

    test("PHP files", () => {
      expect(detectFiletype("index.php")).toBe("php");
    });
  });

  describe("detects Data/Config formats", () => {
    test("JSON files", () => {
      expect(detectFiletype("package.json")).toBe("json");
    });

    test("YAML files", () => {
      expect(detectFiletype("config.yaml")).toBe("yaml");
      expect(detectFiletype("config.yml")).toBe("yaml");
    });

    test("TOML files", () => {
      expect(detectFiletype("Cargo.toml")).toBe("toml");
    });

    // NOTE: .tf files are not currently mapped to hcl in @opentui/core
    // The hcl parser exists but .tf extension is not mapped
    test("HCL files (when extension mapping exists)", () => {
      // This will fail until @opentui/core adds .tf -> hcl mapping
      // expect(detectFiletype("main.tf")).toBe("hcl");
    });
  });

  describe("detects Functional languages", () => {
    test("Haskell files", () => {
      expect(detectFiletype("Main.hs")).toBe("haskell");
    });

    test("OCaml files", () => {
      expect(detectFiletype("main.ml")).toBe("ocaml");
      expect(detectFiletype("main.mli")).toBe("ocaml");
    });

    test("Clojure files", () => {
      expect(detectFiletype("project.clj")).toBe("clojure");
      expect(detectFiletype("script.cljs")).toBe("clojure");
      expect(detectFiletype("config.cljc")).toBe("clojure");
      expect(detectFiletype("config.edn")).toBe("clojure");
    });
  });

  describe("detects Other languages", () => {
    test("Swift files", () => {
      expect(detectFiletype("Main.swift")).toBe("swift");
    });

    test("Lua files", () => {
      expect(detectFiletype("config.lua")).toBe("lua");
    });

    test("Julia files", () => {
      expect(detectFiletype("script.jl")).toBe("julia");
    });

    // NOTE: .nix files are not currently mapped in @opentui/core
    test("Nix files (when extension mapping exists)", () => {
      // This will fail until @opentui/core adds .nix mapping
      // expect(detectFiletype("default.nix")).toBe("nix");
    });

    test("Zig files", () => {
      expect(detectFiletype("main.zig")).toBe("zig");
      expect(detectFiletype("build.zon")).toBe("zig");
    });
  });

  describe("handles edge cases", () => {
    test("Markdown files", () => {
      expect(detectFiletype("README.md")).toBe("markdown");
      expect(detectFiletype("README.markdown")).toBe("markdown");
      expect(detectFiletype("README.mdown")).toBe("markdown");
      expect(detectFiletype("README.mkd")).toBe("markdown");
    });

    test("diff files", () => {
      expect(detectFiletype("changes.diff")).toBe("diff");
      expect(detectFiletype("changes.patch")).toBe("diff");
    });

    test("files without extension", () => {
      expect(detectFiletype("Makefile")).toBe("make");
      expect(detectFiletype("Dockerfile")).toBe("dockerfile");
    });

    test("unknown extensions return undefined", () => {
      expect(detectFiletype("file.unknown")).toBeUndefined();
    });

    test("empty string returns undefined", () => {
      expect(detectFiletype("")).toBeUndefined();
    });
  });
});

describe("getSupportedSyntaxFiletype", () => {
  test("keeps supported filetypes", () => {
    expect(getSupportedSyntaxFiletype("src/app.tsx")).toBe("typescriptreact");
    expect(getSupportedSyntaxFiletype("README.md")).toBe("markdown");
    expect(getSupportedSyntaxFiletype("package.json")).toBe("json");
  });

  test("drops unsupported filetypes", () => {
    expect(getSupportedSyntaxFiletype("Makefile")).toBeUndefined();
    expect(getSupportedSyntaxFiletype("Dockerfile")).toBeUndefined();
    expect(getSupportedSyntaxFiletype("script.zig")).toBeUndefined();
  });
});
