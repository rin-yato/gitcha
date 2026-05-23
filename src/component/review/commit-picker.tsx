import { createSignal, onMount } from "solid-js";

import { $dialog } from "@/store/dialog.store";
import { $review } from "@/store/review.store";
import { $theme } from "@/store/theme.store";

import { git } from "@/lib/git";
import type { GitCommit, GitReviewTarget } from "@/lib/git/types";

import { Select } from "@/component/ui/select";
import type { SelectOption } from "@/component/ui/select/types";

import { Result } from "better-result";

interface CommitPickerProps {
  mode: "single-commit" | "base-commit";
}

function formatCommit(commit: GitCommit): string {
  return `${commit.shortRef}  ${commit.title}`;
}

function toOptions(commits: GitCommit[]): SelectOption<GitCommit>[] {
  return commits.map((commit) => ({
    title: formatCommit(commit),
    value: commit,
  }));
}

export function CommitPicker(props: CommitPickerProps) {
  const [options, setOptions] = createSignal<SelectOption<GitCommit>[]>([]);

  let lastKey = 0;

  onMount(() => {
    loadCommits("");
  });

  async function loadCommits(query: string) {
    const key = ++lastKey;

    const trimmed = query.trim();
    const result = trimmed
      ? await git.commit.search(trimmed, { limit: 30 })
      : await git.commit.list({ limit: 30 });

    if (key !== lastKey) return;

    if (Result.isOk(result)) {
      setOptions(toOptions(result.value));
    }
  }

  function handleSelect(option: SelectOption<GitCommit>) {
    const commit = option.value;
    const target: GitReviewTarget =
      props.mode === "single-commit"
        ? { mode: "single-commit", ref: commit.ref, label: commit.shortRef }
        : { mode: "base-commit", ref: commit.ref, label: commit.shortRef };

    $review.action.start(target);
    $dialog.action.clear();
  }

  return (
    <box width={70} backgroundColor={$theme.token.surface} padding={1}>
      <Select
        height={25}
        title="Select Commit"
        placeholder="Search commits..."
        options={options()}
        onClose={() => $dialog.action.close()}
        onFilter={(value) => loadCommits(value)}
        onSelect={handleSelect}
      />
    </box>
  );
}
