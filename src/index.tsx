import { render } from "@opentui/solid";

import { theme } from "@/constants/theme";

function App() {
  return (
    <box
      id="app"
      backgroundColor={theme.colors.background}
      flexDirection="row"
      width="100%"
      height="100%"
    >
      <box
        id="sidebar"
        backgroundColor={theme.colors.surface}
        border
        borderStyle={theme.border.style}
        borderColor={theme.colors.border}
        width="30%"
        flexDirection="column"
        padding={theme.spacing.md}
      >
        <text id="sidebar-title" content="SOURCE CONTROL" />
        <text id="file-tree" content="No changes detected" />
      </box>
      <box
        id="diff-panel"
        backgroundColor={theme.colors.background}
        border
        borderStyle={theme.border.style}
        borderColor={theme.colors.border}
        flexGrow={1}
        flexDirection="column"
        padding={theme.spacing.md}
      >
        <text id="diff-title" content="DIFF VIEW" />
        <text id="diff-content" content="Select a file to view changes" />
      </box>
    </box>
  );
}

render(() => <App />);

