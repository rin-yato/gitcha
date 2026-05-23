import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

import { git } from "@/lib/git";
import type { GitReviewStatus, GitReviewTarget } from "@/lib/git/types";

import { Result } from "better-result";

type ReviewState = {
  active: boolean;
  target: GitReviewTarget | null;
  status: GitReviewStatus | null;
  loading: boolean;
  error: string | null;
};

const [reviewState, setReviewState] = createStore<ReviewState>({
  active: false,
  target: null,
  status: null,
  loading: false,
  error: null,
});

async function start(target: GitReviewTarget) {
  setReviewState({ active: true, target, loading: true, error: null });

  const result = await git.review.status(target);

  if (Result.isError(result)) {
    setReviewState({ status: null, loading: false, error: result.error.message });
    return;
  }

  setReviewState({ status: result.value, loading: false, error: null });
}

function stop() {
  setReviewState({
    active: false,
    target: null,
    status: null,
    loading: false,
    error: null,
  });
}

export const $review = mergeProps(reviewState, {
  action: {
    start,
    stop,
  },
});
