import { createContext, type ParentComponent, useContext } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";
import { createStore } from "solid-js/store";

export type ExCommandState = {
  visible: boolean;
};

const INITIAL_STATE: ExCommandState = {
  visible: false,
};

// --- Pure actions ---

function open(setState: SetStoreFunction<ExCommandState>) {
  setState("visible", true);
}

function close(setState: SetStoreFunction<ExCommandState>) {
  setState("visible", false);
}

// --- Context + Provider ---

type ExCommandApi = {
  state: Store<ExCommandState>;
  open: () => void;
  close: () => void;
};

const ExCommandContext = createContext<ExCommandApi>();

export const ExCommandProvider: ParentComponent<{
  initialState?: Partial<ExCommandState>;
}> = (props) => {
  const [state, setState] = createStore<ExCommandState>({
    ...INITIAL_STATE,
    ...props.initialState,
  });

  const api: ExCommandApi = {
    state,
    open: () => open(setState),
    close: () => close(setState),
  };

  return <ExCommandContext.Provider value={api}>{props.children}</ExCommandContext.Provider>;
};

export function useExCommand(): ExCommandApi {
  const ctx = useContext(ExCommandContext);
  if (!ctx) {
    throw new Error("useExCommand must be used within ExCommandProvider");
  }
  return ctx;
}
