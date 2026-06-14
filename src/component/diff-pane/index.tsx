import { createMemo, createResource, Match, Switch } from "solid-js";

import { findGitScopedFile, git, toGitUnifiedDiffTarget } from "@/lib/git";
import { formatGitError, type GitError } from "@/lib/git/errors";

import { collectReviewFiles, collectSidebarFiles } from "@/component/sidebar/utils";

import { Result } from "better-result";

import { Diff } from "./diff";
import { useGit } from "@/context/git";
import { useReview } from "@/context/review";
import { useSidebar } from "@/context/sidebar";
import { useTheme } from "@/context/theme";

export function DiffPane() {
  const review = useReview();
  const sidebar = useSidebar();
  const gitStore = useGit();

  const selectedFile = createMemo(() => {
    const files = review.state.active
      ? collectReviewFiles(review.state.status?.files ?? null)
      : collectSidebarFiles(gitStore.state.status);
    return findGitScopedFile(files, sidebar.state.selectedTarget);
  });

  const [diffResource] = createResource(
    () => selectedFile(),
    async (file): Promise<Result<string, GitError> | undefined> => {
      if (!file) return undefined;
      if (review.state.active) {
        const target = review.state.target;
        if (!target) return undefined;
        return git.review.diff(target, toGitUnifiedDiffTarget(file));
      }
      return git.diff.get(toGitUnifiedDiffTarget(file));
    },
  );

  const diffError = createMemo(() => {
    const res = diffResource();
    if (res && Result.isError(res)) return formatGitError(res.error);
    return undefined;
  });

  const diffText = createMemo(() => {
    const res = diffResource();
    if (res && Result.isOk(res)) return res.value;
    return undefined;
  });

  return (
    <Switch>
      <Match when={!selectedFile()}>
        <BlankView />
      </Match>
      <Match when={diffError()}>
        <box width="100%" height="100%" alignItems="center" justifyContent="center">
          <text fg="red">Error: {diffError()}</text>
        </box>
      </Match>
      <Match when={diffText()}>
        <Diff filePath={selectedFile()!.file.path} diff={diffText()!} />
      </Match>
    </Switch>
  );
}

const ASCII_ART = `
█▀▀ ▀█▀ ▀█▀ █▀▀ █ █ █▀█
█ █  █   █  █   █▀█ █▀█
▀▀▀ ▀▀▀  ▀  ▀▀▀ ▀ ▀ ▀ ▀
`;

function BlankView() {
  const review = useReview();
  const theme = useTheme();

  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center" gap={1}>
      <text fg={theme.state.token.fgMuted}>{ASCII_ART}</text>
      <text fg={theme.state.token.fgMuted}>
        {review.state.active ? "no changes in this review" : "worktree is clean"}
      </text>
    </box>
  );
}
