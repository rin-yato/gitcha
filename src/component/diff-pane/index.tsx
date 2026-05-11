import { createMemo, Match, Switch } from "solid-js";

import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar";
import { $theme } from "@/store/theme.store";

import { findGitScopedFile } from "@/lib/git";

import { collectSidebarFiles } from "@/component/sidebar/utils";

import { Diff } from "./diff";

export function DiffPane() {
  const selectedFile = createMemo(() => {
    return findGitScopedFile(collectSidebarFiles($git.status), $sidebar.selectedTarget);
  });

  return (
    <Switch>
      <Match when={selectedFile() === null}>
        <BlankView />
      </Match>

      <Match when={selectedFile()}>{(file) => <Diff selectedFile={file} />}</Match>
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
      <text fg={$theme.token.fgMuted}>worktree is clean</text>
    </box>
  );
}
