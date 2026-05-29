import { createContext, type ParentComponent, useContext } from "solid-js";
import type { Store } from "solid-js/store";
import { createStore } from "solid-js/store";

import { config } from "@/lib/config";
import { getTheme, type ThemeId, type ThemeMode } from "@/lib/themes";
import { createSyntaxStyle, resolveThemeTokens } from "@/lib/themes/theme";

export type ThemeState = {
  themeId: ThemeId;
  mode: ThemeMode;
  token: ReturnType<typeof resolveThemeTokens>;
  syntax: ReturnType<typeof createSyntaxStyle>;
};

function createThemeState(themeId: ThemeId, mode: ThemeMode): ThemeState {
  const token = resolveThemeTokens(getTheme(themeId), mode);

  return {
    themeId,
    mode,
    token,
    syntax: createSyntaxStyle(token),
  };
}

const cfg = config.get();
const INITIAL_STATE: ThemeState = createThemeState(cfg.theme, cfg.themeMode);

// --- Context + Provider ---

type ThemeApi = {
  state: Store<ThemeState>;
};

const ThemeContext = createContext<ThemeApi>();

export const ThemeProvider: ParentComponent<{
  initialState?: Partial<ThemeState>;
}> = (props) => {
  const [state, _setState] = createStore<ThemeState>({
    ...INITIAL_STATE,
    ...props.initialState,
  });

  const api: ThemeApi = { state };

  return <ThemeContext.Provider value={api}>{props.children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
