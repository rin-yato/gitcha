import solidPlugin from "@opentui/solid/bun-plugin";

import packageJson from "../package.json" with { type: "json" };

const outdir = "dist";
const { version } = packageJson;

const result = await Bun.build({
  target: "bun",
  outdir,
  entrypoints: ["./src/index.tsx", "./src/lib/treesitter/parser.worker.ts"],
  minify: true,
  sourcemap: "linked",
  plugins: [solidPlugin],
  define: {
    "process.env.GITCHA_VERSION": JSON.stringify(version),
  },
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
