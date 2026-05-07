import solidPlugin from "@opentui/solid/bun-plugin";

const outdir = "dist";

const result = await Bun.build({
  target: "bun",
  outdir,
  entrypoints: ["./src/index.tsx"],
  minify: true,
  sourcemap: "linked",
  plugins: [solidPlugin],
  naming: {
    entry: "[name].[ext]",
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built ${outdir}`);
