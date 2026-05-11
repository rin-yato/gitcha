import { formatGitError } from "@/lib/git/errors";
import { type GitExCommandError, isGitExCommandParseError } from "@/lib/git/ex-command";
import type { GitCommandOutput } from "@/lib/git/types";

export type GitOutputStream = "stdout" | "stderr";

export type GitOutputState = {
  command: string;
  status: "running" | "success" | "error";
  stdout: string;
  stderr: string;
  message?: string;
  exitCode?: number | null;
  durationMs?: number;
};

export type GitOutputRow = {
  kind: "output";
  text: string;
  stream?: GitOutputStream;
  bold?: boolean;
};

export function formatGitCommand(input: string): string {
  const trimmed = input.trim();
  return trimmed ? `git ${trimmed}` : "git";
}

export function createRunningGitOutput(command: string): GitOutputState {
  return { command, status: "running", stdout: "", stderr: "" };
}

export function appendGitOutput(
  current: GitOutputState | null,
  command: string,
  stream: GitOutputStream,
  text: string,
): GitOutputState | null {
  if (!current || current.command !== command) return current;

  return {
    ...current,
    [stream]: `${current[stream]}${text}`,
  };
}

export function completeGitOutput(
  current: GitOutputState | null,
  command: string,
  output: GitCommandOutput,
): GitOutputState | null {
  if (current?.command !== command) return current;

  return {
    ...current,
    status: "success",
    exitCode: output.exitCode,
    durationMs: output.durationMs,
    stdout: output.stdoutText,
    stderr: output.stderrText,
  };
}

export function failGitOutput(
  current: GitOutputState | null,
  command: string,
  error: GitExCommandError,
): GitOutputState {
  return {
    command,
    status: "error",
    stdout: "stdout" in error ? error.stdout : (current?.stdout ?? ""),
    stderr: "stderr" in error ? error.stderr : (current?.stderr ?? ""),
    message: isGitExCommandParseError(error) ? error.message : formatGitError(error),
    exitCode: "exitCode" in error ? error.exitCode : undefined,
  };
}

export function buildGitOutputRows(output: GitOutputState | null): GitOutputRow[] {
  if (!output) return [];

  const rows: GitOutputRow[] = [
    {
      kind: "output",
      text: getGitOutputStatusLine(output),
      bold: true,
    },
  ];

  if (output.message) {
    rows.push({ kind: "output", text: output.message, stream: "stderr" });
  }

  rows.push(...getStreamRows("stdout", output.stdout));
  rows.push(...getStreamRows("stderr", output.stderr));

  if (rows.length === 1 && output.status === "running") {
    rows.push({ kind: "output", text: "waiting for output..." });
  }

  if (rows.length === 1) {
    rows.push({ kind: "output", text: "completed with no output" });
  }

  return rows;
}

function getGitOutputStatusLine(output: GitOutputState): string {
  if (output.status === "running") return `running ${output.command}`;

  const exit = output.exitCode === undefined ? "" : ` exit ${String(output.exitCode)}`;
  const duration = output.durationMs === undefined ? "" : ` ${String(output.durationMs)}ms`;
  return `${output.status} ${output.command}${exit}${duration}`;
}

function getStreamRows(stream: GitOutputStream, text: string): GitOutputRow[] {
  const trimmed = text.trimEnd();
  if (!trimmed) return [];

  return trimmed.split("\n").map((line) => ({ kind: "output", text: line, stream }));
}
