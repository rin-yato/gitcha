export { buildUnifiedDiffArgs, FULL_DIFF_CONTEXT_LINES } from "./command";
export type { GitDiffStatusLine } from "./parser";
export {
  parseBinaryNumstat,
  parseNameStatus,
  parseNameStatusLine,
  toStatusFiles,
} from "./parser";
export type { GitDiffServiceClient } from "./service";
export { GitDiffService } from "./service";
