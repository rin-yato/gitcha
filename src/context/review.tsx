import { createContext, type ParentComponent, useContext } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";
import { createStore } from "solid-js/store";

import { git } from "@/lib/git";
import type { GitReviewStatus, GitReviewTarget } from "@/lib/git/types";

import { Result } from "better-result";

export type ReviewState = {
  active: boolean;
  target: GitReviewTarget | null;
  status: GitReviewStatus | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: ReviewState = {
  active: false,
  target: null,
  status: null,
  loading: false,
  error: null,
};

// --- Pure actions ---

async function start(setState: SetStoreFunction<ReviewState>, target: GitReviewTarget) {
  setState({ active: true, target, loading: true, error: null });

  const result = await git.review.status(target);

  if (Result.isError(result)) {
    setState({ status: null, loading: false, error: result.error.message });
    return;
  }

  setState({ status: result.value, loading: false, error: null });
}

function stop(setState: SetStoreFunction<ReviewState>) {
  setState({
    active: false,
    target: null,
    status: null,
    loading: false,
    error: null,
  });
}

// --- Context + Provider ---

type ReviewApi = {
  state: Store<ReviewState>;
  start: (target: GitReviewTarget) => Promise<void>;
  stop: () => void;
};

const ReviewContext = createContext<ReviewApi>();

export const ReviewProvider: ParentComponent<{
  initialState?: Partial<ReviewState>;
}> = (props) => {
  const [state, setState] = createStore<ReviewState>({
    ...INITIAL_STATE,
    ...props.initialState,
  });

  const api: ReviewApi = {
    state,
    start: (target) => start(setState, target),
    stop: () => stop(setState),
  };

  return <ReviewContext.Provider value={api}>{props.children}</ReviewContext.Provider>;
};

export function useReview(): ReviewApi {
  const ctx = useContext(ReviewContext);
  if (!ctx) {
    throw new Error("useReview must be used within ReviewProvider");
  }
  return ctx;
}
