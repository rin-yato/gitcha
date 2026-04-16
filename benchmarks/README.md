# Benchmarks

Benchmark tooling lives here so the scripts sit next to the data they manage.

## Commands

- `bun run bench` - run the current benchmark and print a readable report.
- `bun run bench:latest` - refresh `benchmarks/latest.json` with the current run.
- `bun run bench:compare` - compare the current run against `benchmarks/latest.json`.
- `bun run bench:reset-fixture` - remove the cached OpenTUI repo and fixture state.

## Notes

- The benchmark targets the cached OpenTUI repo.
- It runs from `packages/core` inside that repo.
