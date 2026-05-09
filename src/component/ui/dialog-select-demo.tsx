import { $dialog } from "@/store/dialog.store";
import { $theme } from "@/store/theme.store";
import { $toast } from "@/store/toast.store";

import { DialogSelect, type DialogSelectOption } from "./dialog-select";

const DEMO_OPTIONS: DialogSelectOption<string>[] = [
  { title: "Open Diff", value: "open-diff", description: "enter", category: "Navigation" },
  {
    title: "Toggle Sidebar",
    value: "toggle-sidebar",
    description: "\\",
    category: "Navigation",
  },
  { title: "Refresh Repo", value: "refresh-repo", description: "r", category: "Actions" },
  { title: "Copy Path", value: "copy-path", description: "y", category: "Actions" },
  { title: "Switch Theme", value: "switch-theme", description: "t", category: "Appearance" },
  { title: "Show Help", value: "show-help", description: "?", category: "Appearance" },
];

export function DialogSelectDemo() {
  return (
    <box width={70} height={30} backgroundColor={$theme.token.bg}>
      <DialogSelect
        title="Dialog Select Demo"
        placeholder="Search demo actions"
        options={DEMO_OPTIONS}
        current="refresh-repo"
        onSelect={(option) => {
          $toast.action.success(`Selected: ${option.title}`);
          $dialog.action.close();
        }}
      />
    </box>
  );
}
