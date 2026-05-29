import { batch, createContext, type ParentComponent, useContext } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";
import { createStore, produce } from "solid-js/store";

import { config } from "@/lib/config";
import type { GitFileTarget } from "@/lib/git";
import { isGitFileTargetEqual } from "@/lib/git";

import { isSidebarDirectoryKeyForTarget } from "./sidebar-key";

export type SidebarViewMode = "flat" | "tree";

export type SidebarState = {
  width: number;
  open: boolean;
  selectedTarget: GitFileTarget | null;
  viewMode: SidebarViewMode;
  collapsedDirectoryKeys: string[];
};

const cfg = config.get();

const INITIAL_STATE: SidebarState = {
  width: cfg.sidebar.defaultWidth,
  open: cfg.sidebar.defaultOpen,
  selectedTarget: null,
  viewMode: "tree",
  collapsedDirectoryKeys: [],
};

const MIN_WIDTH = 15;

// --- Pure helpers (no side effects) ---

function selectByOffset(
  files: GitFileTarget[],
  offset: number,
  selectedTarget: GitFileTarget | null,
): GitFileTarget | null {
  if (files.length === 0) return null;

  const currentIndex = files.findIndex((file) => isGitFileTargetEqual(file, selectedTarget));

  if (currentIndex === -1) return files[0] ?? null;

  const nextIndex = (currentIndex + offset + files.length) % files.length;

  return files[nextIndex] ?? null;
}

// --- Pure actions (accept setState) ---

function setSelectedTarget(
  setState: SetStoreFunction<SidebarState>,
  selectedTarget: GitFileTarget | null,
): void {
  batch(() => {
    if (selectedTarget) {
      setState("collapsedDirectoryKeys", (keys) => {
        const nextKeys = keys.filter(
          (key) => !isSidebarDirectoryKeyForTarget(key, selectedTarget),
        );

        return nextKeys.length === keys.length ? keys : nextKeys;
      });
    }

    setState("selectedTarget", selectedTarget);
  });
}

function selectNext(
  setState: SetStoreFunction<SidebarState>,
  files: GitFileTarget[],
  currentSelectedTarget: GitFileTarget | null,
) {
  setSelectedTarget(setState, selectByOffset(files, 1, currentSelectedTarget));
}

function selectPrevious(
  setState: SetStoreFunction<SidebarState>,
  files: GitFileTarget[],
  currentSelectedTarget: GitFileTarget | null,
) {
  setSelectedTarget(setState, selectByOffset(files, -1, currentSelectedTarget));
}

function toggle(setState: SetStoreFunction<SidebarState>) {
  setState("open", (open) => !open);
}

function toggleViewMode(setState: SetStoreFunction<SidebarState>) {
  setState("viewMode", (viewMode) => (viewMode === "flat" ? "tree" : "flat"));
}

function toggleDirectory(setState: SetStoreFunction<SidebarState>, key: string) {
  setState("collapsedDirectoryKeys", (keys) =>
    keys.includes(key) ? keys.filter((entry) => entry !== key) : [...keys, key],
  );
}

function setCollapsedDirectoryKeys(
  setState: SetStoreFunction<SidebarState>,
  keys: readonly string[],
) {
  setState("collapsedDirectoryKeys", [...keys]);
}

function increaseWidth(setState: SetStoreFunction<SidebarState>, delta: number = 5) {
  setState(
    produce((state) => {
      if (!state.open) state.open = true;
      state.width += delta;
    }),
  );
}

function decreaseWidth(setState: SetStoreFunction<SidebarState>, delta: number = 5) {
  setState(
    produce((state) => {
      const nextWidth = state.width - delta;

      if (nextWidth <= MIN_WIDTH) {
        state.open = false;
        state.width = MIN_WIDTH;
        return;
      }

      if (!state.open) state.open = true;
      state.width = nextWidth;
    }),
  );
}

// --- Context + Provider ---

type SidebarApi = {
  state: Store<SidebarState>;
  setSelectedTarget: (target: GitFileTarget | null) => void;
  selectNext: (files: GitFileTarget[]) => void;
  selectPrevious: (files: GitFileTarget[]) => void;
  toggle: () => void;
  toggleViewMode: () => void;
  toggleDirectory: (key: string) => void;
  setCollapsedDirectoryKeys: (keys: readonly string[]) => void;
  increaseWidth: (delta?: number) => void;
  decreaseWidth: (delta?: number) => void;
};

const SidebarContext = createContext<SidebarApi>();

export const SidebarProvider: ParentComponent<{
  initialState?: Partial<SidebarState>;
}> = (props) => {
  const [state, setState] = createStore<SidebarState>({
    ...INITIAL_STATE,
    ...props.initialState,
  });

  const api: SidebarApi = {
    state,
    setSelectedTarget: (target) => setSelectedTarget(setState, target),
    selectNext: (files) => selectNext(setState, files, state.selectedTarget),
    selectPrevious: (files) => selectPrevious(setState, files, state.selectedTarget),
    toggle: () => toggle(setState),
    toggleViewMode: () => toggleViewMode(setState),
    toggleDirectory: (key) => toggleDirectory(setState, key),
    setCollapsedDirectoryKeys: (keys) => setCollapsedDirectoryKeys(setState, keys),
    increaseWidth: (delta) => increaseWidth(setState, delta),
    decreaseWidth: (delta) => decreaseWidth(setState, delta),
  };

  return <SidebarContext.Provider value={api}>{props.children}</SidebarContext.Provider>;
};

export function useSidebar(): SidebarApi {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
