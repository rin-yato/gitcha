import type { RGBA } from "@opentui/core";

import type { JSX } from "solid-js";

export type SelectInputMode = "keyboard" | "mouse";

export type SelectState = {
  selected: number;
  filter: string;
  input: SelectInputMode;
};

export interface SelectProps<T> {
  title: string;
  placeholder?: string;
  options: SelectOption<T>[];
  height?: number;
  flat?: boolean;
  ref?: (ref: SelectRef<T>) => void;
  onClose?: () => void;
  onMove?: (option: SelectOption<T>) => void;
  onFilter?: (query: string) => void;
  onSelect?: (option: SelectOption<T>) => void;
  skipFilter?: boolean;
  renderFilter?: boolean;
  current?: T;
}

export interface SelectOption<T = unknown> {
  title: string;
  value: T;
  description?: string;
  footer?: JSX.Element | string;
  category?: string;
  categoryView?: JSX.Element;
  disabled?: boolean;
  bg?: RGBA;
  gutter?: () => JSX.Element;
  margin?: JSX.Element;
  onSelect?: () => void;
}

export type SelectRef<T> = {
  filter: string;
  filtered: SelectOption<T>[];
};

export type FilteredOption<T> = {
  option: SelectOption<T>;
  category: string;
  sourceIndex: number;
  score: number;
};

export type FilteredGroup<T> = {
  category: string;
  options: FilteredOption<T>[];
};

export type SelectRow<T = unknown> =
  | { kind: "group"; key: string; label: string; categoryView?: JSX.Element }
  | {
      kind: "option";
      key: string;
      group: string;
      option: SelectOption<T>;
      index: number;
    };

export type SelectHeightInput = {
  contentHeight: number;
  terminalHeight: number;
  height?: number;
  filterEnabled: boolean;
};
