import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

import { git } from "@/lib/git";
import type { GitRepoStatus } from "@/lib/git/types";

import { Result } from "better-result";

type GitState = {
  status: GitRepoStatus | null;
  loading: boolean;
  error: string | null;
};

const [gitState, setGitState] = createStore<GitState>({
  status: null,
  loading: false,
  error: null,
});

async function refresh() {
  setGitState({ loading: true, error: null });

  const result = await git.status.get();

  if (Result.isError(result)) {
    setGitState({ status: null, loading: false, error: result.error.message });
    return null;
  }

  setGitState({ status: result.value, loading: false, error: null });
  return result.value;
}

export const $git = mergeProps(gitState, {
  action: {
    refresh,
  },
});
