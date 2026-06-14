import { getTheme, THEME_IDS, type ThemeId } from "@/lib/themes";

import { Select } from "@/component/ui/select";
import type { SelectOption } from "@/component/ui/select/types";

import { useDialog } from "@/context/dialog";
import { useTheme } from "@/context/theme";

export function ThemePicker() {
  const dialog = useDialog();
  const theme = useTheme();

  const originalThemeId = theme.state.themeId;

  const options: SelectOption<ThemeId>[] = THEME_IDS.map((id) => ({
    title: getTheme(id).name ?? id,
    value: id,
  }));

  return (
    <box width={50} backgroundColor={theme.state.token.surface} padding={1}>
      <Select
        height={25}
        title="Select Theme"
        options={options}
        skipFilter
        current={originalThemeId}
        onMove={(option) => {
          theme.setTheme(option.value);
        }}
        onClose={() => {
          theme.setTheme(originalThemeId);
          dialog.close();
        }}
        onSelect={(option) => {
          theme.setTheme(option.value);
          dialog.close();
        }}
      />
    </box>
  );
}
