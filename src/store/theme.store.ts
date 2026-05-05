import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

import { getThemeMode, normalizeThemeId, type ThemeId, type ThemeMode } from "@/lib/themes";

type ThemeState = {
  themeId: ThemeId;
  mode: ThemeMode;
};

const [themeState, setThemeState] = createStore<ThemeState>({
  themeId: normalizeThemeId(process.env.CHANGES_THEME),
  mode: getThemeMode(process.env.CHANGES_THEME_MODE),
});

export const $theme = mergeProps(themeState, {
  action: {
    setTheme: (theme: ThemeId) => {
      setThemeState("themeId", theme);
    },

    setMode: (mode: ThemeMode) => {
      setThemeState("mode", mode);
    },
  },
});
