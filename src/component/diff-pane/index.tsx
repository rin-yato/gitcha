import { createMemo, createResource, Match, Switch } from "solid-js";

import { $git } from "@/store/git.store";
import { $review } from "@/store/review.store";
import { $sidebar } from "@/store/sidebar";
import { $theme } from "@/store/theme.store";

import { findGitScopedFile, git, toGitUnifiedDiffTarget } from "@/lib/git";

import { collectReviewFiles, collectSidebarFiles } from "@/component/sidebar/utils";

import { Result } from "better-result";

import { Diff } from "./diff";

export function DiffPane() {
  const selectedFile = createMemo(() => {
    const files = $review.active
      ? collectReviewFiles($review.status?.files ?? null)
      : collectSidebarFiles($git.status);
    return findGitScopedFile(files, $sidebar.selectedTarget);
  });

  const [diffResource] = createResource(
    () => selectedFile(),
    async (file) => {
      if (!file) return undefined;
      if ($review.active) {
        const target = $review.target;
        if (!target) return undefined;
        return git.review.diff(target, toGitUnifiedDiffTarget(file)).then(Result.unwrap);
      }
      return git.diff.get(toGitUnifiedDiffTarget(file)).then(Result.unwrap);
    },
  );

  return (
    <Switch>
      <Match when={!selectedFile()}>
        <BlankView />
      </Match>
      <Match when={diffResource.error}>
        <box width="100%" height="100%" alignItems="center" justifyContent="center">
          <text fg="red">Error: {String(diffResource.error)}</text>
        </box>
      </Match>
      <Match when={diffResource()}>
        {(diff) => <Diff filePath={selectedFile()!.file.path} diff={diff()} />}
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
  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center" gap={1}>
      <text fg={$theme.token.fgMuted}>{ASCII_ART}</text>
      <text fg={$theme.token.fgMuted}>
        {$review.active ? "no changes in this review" : "worktree is clean"}
      </text>
    </box>
  );
}
