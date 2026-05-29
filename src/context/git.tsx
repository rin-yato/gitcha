import { createContext, type ParentComponent, useContext } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";
import { createStore } from "solid-js/store";

import { git } from "@/lib/git";
import type { GitRepoStatus } from "@/lib/git/types";

import { Result } from "better-result";

export type GitState = {
  status: GitRepoStatus | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: GitState = {
  status: null,
  loading: false,
  error: null,
};

// --- Pure actions ---

async function refresh(setState: SetStoreFunction<GitState>) {
  setState({ loading: true, error: null });

  const result = await git.status.get();

  if (Result.isError(result)) {
    setState({ status: null, loading: false, error: result.error.message });
    return null;
  }

  setState({ status: result.value, loading: false, error: null });
  return result.value;
}

// --- Context + Provider ---

type GitApi = {
  state: Store<GitState>;
  refresh: () => ReturnType<typeof refresh>;
};

const GitContext = createContext<GitApi>();

export const GitProvider: ParentComponent<{
  initialState?: Partial<GitState>;
}> = (props) => {
  const [state, setState] = createStore<GitState>({
    ...INITIAL_STATE,
    ...props.initialState,
  });

  const api: GitApi = { state, refresh: () => refresh(setState) };

  return <GitContext.Provider value={api}>{props.children}</GitContext.Provider>;
};

export function useGit(): GitApi {
  const ctx = useContext(GitContext);
  if (!ctx) {
    throw new Error("useGit must be used within GitProvider");
  }
  return ctx;
}
