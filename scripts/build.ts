const outDir = "dist";
const outFile = `${outDir}/sourcery`;
const compileTarget = process.arch === "x64" ? "bun-darwin-x64" : "bun-darwin-arm64";

await Bun.build({
  entrypoints: ["./src/index.tsx"],
  target: "bun",
  outdir: outDir,
  compile: {
    target: compileTarget,
    outfile: outFile,
  },
});

console.log(`Built ${outFile}`);

export {};
