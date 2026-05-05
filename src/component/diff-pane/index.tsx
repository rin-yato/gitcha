import { $theme } from "@/store/theme.store";

export function DiffPane() {
  return (
    <box backgroundColor={$theme.token.bg} width="100%">
      <text fg="black">DiffPane</text>
    </box>
  );
}
