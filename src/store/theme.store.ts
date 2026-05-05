import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

import { $config } from "@/store/config.store";

import { getTheme, type ThemeId, type ThemeMode } from "@/lib/themes";
import { createSyntaxStyle, resolveThemeTokens } from "@/lib/themes/theme";

type ThemeState = {
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

const [themeState, setThemeState] = createStore<ThemeState>(
  createThemeState($config.theme, $config.themeMode),
);

function syncThemeState(themeId: ThemeId, mode: ThemeMode) {
  setThemeState(createThemeState(themeId, mode));
}

export const $theme = mergeProps(themeState, {
  action: {
    setTheme: (themeId: ThemeId) => {
      syncThemeState(themeId, themeState.mode);
    },
    setMode: (mode: ThemeMode) => {
      syncThemeState(themeState.themeId, mode);
    },
  },
});
