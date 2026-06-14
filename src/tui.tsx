import { addDefaultParsers } from "@opentui/core";
import { KeymapProvider, useBindings } from "@opentui/keymap/solid";
import { extend, useRenderer, useSelectionHandler } from "@opentui/solid";

import { copySelection } from "@/lib/clipboard";
import { createAppKeymap } from "@/lib/keymap";
import { parsers } from "@/lib/treesitter/parsers";

import { DiffPane } from "@/component/diff-pane";
import { ExCommandPrompt } from "@/component/ex-command-prompt";
import { ModeSelect } from "@/component/review/mode-select";
import { Sidebar } from "@/component/sidebar";
import { ThemePicker } from "@/component/theme-picker";
import { Dialog } from "@/component/ui/dialog";
import { Toast } from "@/component/ui/toast";

import { VirtualizedDiffRenderable } from "./component/virtualized-diff";
import { DialogProvider, useDialog } from "@/context/dialog";
import { ExCommandProvider, useExCommand } from "@/context/ex-command";
import { GitProvider } from "@/context/git";
import { ReviewProvider } from "@/context/review";
import { SidebarProvider } from "@/context/sidebar";
import { ThemeProvider } from "@/context/theme";
import { ToastProvider, useToast } from "@/context/toast";

addDefaultParsers(parsers);

extend({
  virtualized_diff: VirtualizedDiffRenderable,
});

function AppKeymapBindings() {
  const renderer = useRenderer();
  const dialog = useDialog();
  const exCommand = useExCommand();
  const toast = useToast();

  useSelectionHandler(() => {
    copySelection(
      renderer,
      () => toast.success("Copied to clipboard"),
      (msg) => toast.error(msg),
    );
  });

  useBindings(() => ({
    enabled: () => !exCommand.state.visible && dialog.state.stack.length === 0,
    commands: [
      {
        name: "app.quit",
        run() {
          renderer.destroy();
        },
      },
      {
        name: "review.open",
        run() {
          dialog.show({ component: ModeSelect });
        },
      },
      {
        name: "theme.choose",
        run() {
          dialog.show({ component: ThemePicker });
        },
      },
    ],
    bindings: [
      {
        key: "q",
        cmd: "app.quit",
        desc: "Quit app",
      },
      {
        key: "v",
        cmd: "review.open",
        desc: "Review",
      },
      {
        key: "t",
        cmd: "theme.choose",
        desc: "Choose theme",
      },
    ],
  }));
}

export function TUI() {
  const renderer = useRenderer();
  const keymap = createAppKeymap(renderer);

  return (
    <KeymapProvider keymap={keymap}>
      <ThemeProvider>
        <GitProvider>
          <ReviewProvider>
            <SidebarProvider>
              <DialogProvider>
                <ToastProvider>
                  <ExCommandProvider>
                    <AppKeymapBindings />

                    <Dialog />
                    <ExCommandPrompt />
                    <Toast />

                    <box width="100%" height="100%" flexDirection="row">
                      <Sidebar />
                      <DiffPane />
                    </box>
                  </ExCommandProvider>
                </ToastProvider>
              </DialogProvider>
            </SidebarProvider>
          </ReviewProvider>
        </GitProvider>
      </ThemeProvider>
    </KeymapProvider>
  );
}
