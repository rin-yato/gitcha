import { $config } from "@/store/config.store";

export function Sidebar() {
  return (
    <box backgroundColor="gray" width={$config.sidebar.defaultWidth}>
      <text fg="black">Sidebar</text>
    </box>
  );
}
