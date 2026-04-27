import fs from "fs";

const outdir = "dist";
const { version: appVersion } = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  version: string;
};

const result = await Bun.build({
  target: "bun",
  outdir,
  entrypoints: ["./src/index.tsx", "./src/lib/treesitter/parser.worker.ts"],
  minify: true,
  sourcemap: "linked",
  define: {
    "process.env.CHANGES_APP_VERSION": JSON.stringify(appVersion),
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
