import { render } from "@opentui/solid";

import { ThemeProvider, useTheme } from "./styles/theme";

function App() {
  const theme = useTheme();

  return (
    <box id="app" flexDirection="row" width="100%" height="100%">
      <box
        id="sidebar"
        backgroundColor={theme().surface}
        border
        borderStyle="single"
        borderColor={theme().border}
        width="30%"
        flexDirection="column"
        padding={1}
      >
        <text id="sidebar-title" content="SOURCE CONTROL" />
        <text id="file-tree" content="No changes detected" />
      </box>
      <box
        id="diff-panel"
        border
        borderStyle="single"
        borderColor={theme().border}
        flexGrow={1}
        flexDirection="column"
        padding={1}
      >
        <text id="diff-title" content="DIFF VIEW" />
        <text id="diff-content" fg="black" content="Select a file to view changes" />
        <text id="henlo" fg="black" content={JSON.stringify(theme(), null, 2)} />
      </box>
    </box>
  );
}

render(() => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
));
