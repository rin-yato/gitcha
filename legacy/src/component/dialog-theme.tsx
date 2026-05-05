import { useCallback } from "react";

import type { Theme } from "@/context/theme/provider";
import { useThemeSettings } from "@/context/theme/provider";

import { DialogSelect, type DialogSelectOption } from "@/component/ui/dialog-select";
import { Overlay } from "@/component/ui/overlay";

import { THEMES } from "@/themes";

type ThemeOption = DialogSelectOption<string>;

export function ThemeDialog(props: { theme: Theme; onClose: () => void }) {
  const { theme, onClose } = props;
  const { themeId, themeIds, setThemeId } = useThemeSettings();

  const options = themeIds.map((id) => ({
    title: THEMES[id].name,
    value: id,
    description: id === themeId ? "Current theme" : undefined,
    category: "Themes",
  })) satisfies ThemeOption[];

  const handleSelect = useCallback(
    (option: ThemeOption) => {
      setThemeId(option.value);
      onClose();
    },
    [onClose, setThemeId],
  );

  return (
    <Overlay>
      <DialogSelect
        theme={theme}
        title="Themes"
        placeholder="Search themes..."
        options={options}
        current={themeId}
        onSelect={handleSelect}
        onClose={onClose}
        width={64}
        height={24}
      />
    </Overlay>
  );
}
