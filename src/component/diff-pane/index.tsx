import { createMemo, Match, Switch } from "solid-js";

import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

import { collectSidebarFiles } from "@/component/sidebar/utils";

import { Diff } from "./diff";

export function DiffPane() {
  const selectedFile = createMemo(() => {
    const files = collectSidebarFiles($git.status);
    return files.find((file) => file.path === $sidebar.selectedPath) ?? null;
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
