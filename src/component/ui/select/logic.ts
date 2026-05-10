import * as fuzzysort from "fuzzysort";

import type { FilteredGroup, FilteredOption, SelectOption, SelectRow } from "./types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getFlatOptions<T>(options: SelectOption<T>[]) {
  const flat: FilteredOption<T>[] = [];

  for (const option of options) {
    if (option.disabled) continue;

    flat.push({
      option,
      category: option.category?.trim() ?? "",
      sourceIndex: flat.length,
      score: 0,
    });
  }

  return flat;
}

export function getFilteredOptions<T>(
  options: SelectOption<T>[],
  filterValue: string,
  skipFilter = false,
) {
  const needle = normalize(filterValue);
  const flat = getFlatOptions(options);

  if (skipFilter || !needle) {
    return flat;
  }

  return fuzzysort
    .go(needle, flat, {
      keys: [
        (entry) => entry.option.title,
        (entry) => entry.category,
        (entry) => entry.option.description ?? "",
      ],
      scoreFn: (result) => {
        const titleScore = result[0]?.score ?? 0;
        const categoryScore = result[1]?.score ?? 0;
        const descriptionScore = result[2]?.score ?? 0;

        // Titles are the main intent signal; category/description are secondary
        // so shortcuts and group names can still discover commands.
        return titleScore * 2 + categoryScore + descriptionScore * 0.5;
      },
    })
    .map((entry) => ({
      ...entry.obj,
      score: entry.score,
    }))
    .sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex);
}

export function groupFilteredOptions<T>(filtered: FilteredOption<T>[], flatten: boolean) {
  if (flatten) {
    return [{ category: "", options: filtered }] satisfies FilteredGroup<T>[];
  }

  const groups: FilteredGroup<T>[] = [];
  const byCategory = new Map<string, FilteredGroup<T>>();

  for (const entry of filtered) {
    const existing = byCategory.get(entry.category);

    if (existing) {
      existing.options.push(entry);
      continue;
    }

    const nextGroup: FilteredGroup<T> = {
      category: entry.category,
      options: [entry],
    };

    groups.push(nextGroup);
    byCategory.set(entry.category, nextGroup);
  }

  return groups;
}

export function buildRowsFromGroups<T>(groups: FilteredGroup<T>[]) {
  const rows: SelectRow<T>[] = [];
  let index = 0;

  for (const group of groups) {
    if (group.category) {
      const categoryView = group.options.find((entry) => entry.option.categoryView)?.option
        .categoryView;
      rows.push(
        categoryView === undefined
          ? { kind: "group", key: `group:${group.category}`, label: group.category }
          : {
              kind: "group",
              key: `group:${group.category}`,
              label: group.category,
              categoryView,
            },
      );
    }

    for (const entry of group.options) {
      rows.push({
        kind: "option",
        key: `option:${group.category}:${index}:${entry.option.title}`,
        group: group.category,
        option: entry.option,
        index,
      });
      index += 1;
    }
  }

  return rows;
}

export function buildSelectRows<T>(options: SelectOption<T>[], filterValue: string) {
  return buildRowsFromGroups(
    groupFilteredOptions(getFilteredOptions(options, filterValue), false),
  );
}
