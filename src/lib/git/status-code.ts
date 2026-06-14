import type { GitFileStatus } from "./types";

export function parseStatusCode(value: string | undefined): GitFileStatus {
  return (value || " ") as GitFileStatus;
}
