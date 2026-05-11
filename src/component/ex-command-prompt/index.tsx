import {
  type CliRenderer,
  type InputRenderable,
  type KeyEvent,
  type Renderable,
  TextAttributes,
} from "@opentui/core";
import type { Command } from "@opentui/keymap";
import type { ExCommandPayload } from "@opentui/keymap/addons/opentui";
import { useBindings, useKeymap, useKeymapSelector } from "@opentui/keymap/solid";
import { useRenderer } from "@opentui/solid";

import { batch, createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";

import { $dialog } from "@/store/dialog.store";
import { $exCommand } from "@/store/ex-command.store";
import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";
import { $toast } from "@/store/toast.store";

import {
  applyExPromptSuggestionFromList,
  EX_PROMPT_MAX_VISIBLE_SUGGESTIONS,
  type ExArgCount,
  type ExPromptSuggestion,
  getExPromptCommandText,
  getExPromptSuggestions,
  getSelectedExPromptSuggestionFromList,
  moveExPromptSelectionInList,
  parseExPromptInput,
} from "./logic";

const EX_PROMPT_WIDTH = 54;
const EX_PROMPT_CHROME_ROWS = 5;
const EX_PROMPT_MAX_HEIGHT = EX_PROMPT_CHROME_ROWS + EX_PROMPT_MAX_VISIBLE_SUGGESTIONS;

type AppExCommand = Command<Renderable, KeyEvent, ExCommandPayload> & {
  name: string;
  aliases?: string[];
  nargs?: ExArgCount;
  title: string;
  desc: string;
  category: string;
  usage: string;
};

type SuggestionRow = { kind: "empty" } | { kind: "suggestion"; suggestion: ExPromptSuggestion };

function createAppExCommands(renderer: CliRenderer): AppExCommand[] {
  return [
    {
      name: "quit",
      aliases: ["q"],
      nargs: "0",
      title: "Quit",
      desc: "Quit gitcha",
      category: "App",
      usage: ":quit",
      run() {
        renderer.destroy();
      },
    },
    {
      name: "refresh",
      aliases: ["reload", "r"],
      nargs: "0",
      title: "Refresh",
      desc: "Refresh git status",
      category: "Git",
      usage: ":refresh",
      async run() {
        await $git.action.refresh();
        $toast.action.success("Refreshed git status");
      },
    },
    {
      name: "sidebar",
      aliases: ["sb"],
      nargs: "0",
      title: "Toggle sidebar",
      desc: "Toggle sidebar",
      category: "View",
      usage: ":sidebar",
      run() {
        $sidebar.action.toggle();
      },
    },
  ];
}

export function ExCommandPrompt() {
  const renderer = useRenderer();
  const manager = useKeymap();

  let inputRef: InputRenderable | undefined;
  let restoreTarget: Renderable | undefined;

  const [target, setTarget] = createSignal<InputRenderable | undefined>(undefined);
  const [value, setValue] = createSignal("");
  const [selection, setSelection] = createSignal(0);

  const syncInput = (nextValue: string) => {
    if (!inputRef) return;

    if (inputRef.value !== nextValue) {
      inputRef.value = nextValue;
    }

    inputRef.cursorOffset = nextValue.length;
  };

  const close = () => {
    batch(() => {
      $exCommand.action.close();
      setValue("");
      setSelection(0);
      setTarget(undefined);
    });
    inputRef = undefined;
  };

  const restoreFocus = () => {
    const targetToRestore = restoreTarget;
    restoreTarget = undefined;

    if (targetToRestore && !targetToRestore.isDestroyed) {
      targetToRestore.focus();
    }
  };

  const closeAndRestore = () => {
    close();
    restoreFocus();
  };

  const open = () => {
    if ($exCommand.visible) return;

    restoreTarget = renderer.currentFocusedRenderable ?? undefined;
    inputRef = undefined;
    batch(() => {
      setTarget(undefined);
      $exCommand.action.open();
      setValue("");
      setSelection(0);
    });
  };

  const offExCommands = manager.registerLayer({
    commands: createAppExCommands(renderer).map((command) => ({
      ...command,
      namespace: "excommands",
    })),
  });

  const discoveredExCommands = useKeymapSelector((keymap) =>
    keymap.getCommands({ namespace: "excommands" }),
  );

  const suggestions = createMemo(() => getExPromptSuggestions(discoveredExCommands(), value()));
  const suggestionRows = createMemo<SuggestionRow[]>(() => {
    const currentSuggestions = suggestions();
    if (currentSuggestions.length === 0) return [{ kind: "empty" }];

    return currentSuggestions.map((suggestion) => ({ kind: "suggestion", suggestion }));
  });
  const clampedSelection = createMemo(() =>
    Math.min(selection(), Math.max(suggestions().length - 1, 0)),
  );
  const selectedSuggestion = createMemo(() =>
    getSelectedExPromptSuggestionFromList(suggestions(), clampedSelection()),
  );
  const usage = createMemo(() => {
    const selected = selectedSuggestion();
    if (!selected) return "No matching ex commands";

    return `Usage: ${selected.usage}  |  ${selected.desc}`;
  });

  const moveSelection = (direction: 1 | -1) => {
    setSelection((current) => moveExPromptSelectionInList(suggestions(), current, direction));
  };

  const applySuggestion = (direction?: 1 | -1) => {
    const result = applyExPromptSuggestionFromList(
      suggestions(),
      value(),
      selection(),
      direction,
    );
    if (!result) return;

    batch(() => {
      setSelection(result.selection);
      setValue(result.value);
    });
    syncInput(result.value);
  };

  const execute = () => {
    const parsed = parseExPromptInput(value());
    if (!parsed) {
      closeAndRestore();
      return;
    }

    const targetToRestore = restoreTarget;
    const focused =
      targetToRestore && !targetToRestore.isDestroyed
        ? targetToRestore
        : renderer.currentFocusedRenderable;
    const result = manager.runCommand(parsed.raw, {
      focused: focused ?? null,
      includeCommand: true,
    });

    if (!result.ok) {
      if (result.reason === "not-found") {
        $toast.action.error(`Unknown ex command ${parsed.name}`);
        return;
      }

      if (result.reason === "invalid-args") {
        $toast.action.warning(
          `Usage: ${result.command ? (getExPromptCommandText(result.command, "usage") ?? parsed.name) : parsed.name}`,
        );
        return;
      }

      $toast.action.error(`Command ${parsed.name} failed`);
      return;
    }

    closeAndRestore();
  };

  useBindings(() => ({
    enabled: () => $dialog.stack.length === 0 && !$exCommand.visible,
    commands: [
      {
        name: "ex-command.open",
        run: open,
      },
    ],
    bindings: [{ key: ":", cmd: "ex-command.open", desc: "Open ex command prompt" }],
  }));

  useBindings<InputRenderable>(() => ({
    target,
    targetMode: "focus",
    enabled: () => $exCommand.visible,
    commands: [
      {
        name: "ex-command.close",
        run: closeAndRestore,
      },
      {
        name: "ex-command.prev",
        run: () => moveSelection(-1),
      },
      {
        name: "ex-command.next",
        run: () => moveSelection(1),
      },
      {
        name: "ex-command.complete",
        run: () => applySuggestion(),
      },
      {
        name: "ex-command.complete-prev",
        run: () => applySuggestion(-1),
      },
      {
        name: "ex-command.submit",
        run: execute,
      },
    ],
    bindings: [
      { key: "escape", cmd: "ex-command.close", desc: "Close ex command prompt" },

      { key: "up", cmd: "ex-command.prev", desc: "Previous suggestion" },
      { key: "down", cmd: "ex-command.next", desc: "Next suggestion" },
      { key: "ctrl+p", cmd: "ex-command.prev", desc: "Previous suggestion" },
      { key: "ctrl+n", cmd: "ex-command.next", desc: "Next suggestion" },

      { key: "tab", cmd: "ex-command.complete", desc: "Complete suggestion" },
      { key: "shift+tab", cmd: "ex-command.complete-prev", desc: "Previous completion" },
      { key: "return", cmd: "ex-command.submit", desc: "Run ex command" },
    ],
  }));

  createEffect(() => {
    const currentSuggestions = suggestions();
    const lastIndex = currentSuggestions.length - 1;

    setSelection((current) => {
      if (lastIndex < 0) return current === 0 ? current : 0;
      return current > lastIndex ? lastIndex : current;
    });
  });

  createEffect(() => {
    if (!$exCommand.visible) return;

    const input = target();
    if (!input || input.isDestroyed) return;

    input.focus();
  });

  onCleanup(() => {
    offExCommands();
  });

  return (
    <Show when={$exCommand.visible}>
      <box
        id="ex-command-prompt-shell"
        position="absolute"
        left="50%"
        top="50%"
        width={EX_PROMPT_WIDTH}
        marginLeft={-(EX_PROMPT_WIDTH / 2)}
        marginTop={-Math.ceil(EX_PROMPT_MAX_HEIGHT / 2)}
        flexDirection="column"
        zIndex={3500}
        visible={$exCommand.visible}
      >
        <box
          id="ex-command-prompt"
          width={EX_PROMPT_WIDTH}
          height={EX_PROMPT_CHROME_ROWS}
          border
          borderStyle="single"
          borderColor={$theme.token.accent}
          backgroundColor={$theme.token.surface}
          paddingX={1}
          paddingY={0}
          flexDirection="column"
          title=" Ex Command "
          titleAlignment="center"
        >
          <text id="ex-command-prompt-hint" fg={$theme.token.fgMuted} height={1}>
            tab complete | up/down | enter | esc
          </text>
          <box width="100%" flexDirection="row" backgroundColor={$theme.token.surface}>
            <input
              id="ex-command-input"
              ref={(input: InputRenderable) => {
                inputRef = input;
                input.cursorOffset = value().length;
                setTarget(input);
              }}
              width={EX_PROMPT_WIDTH - 3}
              value={value()}
              placeholder="refresh"
              backgroundColor={$theme.token.surface}
              focusedBackgroundColor={$theme.token.bg}
              textColor={$theme.token.fg}
              focusedTextColor={$theme.token.fg}
              placeholderColor={$theme.token.fgMuted}
              cursorColor={$theme.token.accent}
              onInput={(nextValue) => {
                batch(() => {
                  setValue(nextValue);
                  setSelection(0);
                });
              }}
            />
          </box>
          <text
            id="ex-command-prompt-usage"
            fg={selectedSuggestion() ? $theme.token.fg : $theme.token.fgMuted}
            height={1}
          >
            {usage()}
          </text>
        </box>
        <box
          id="ex-command-prompt-list"
          width={EX_PROMPT_WIDTH}
          height={suggestionRows().length}
          backgroundColor={$theme.token.surface}
          paddingX={1}
          paddingY={0}
          flexDirection="column"
        >
          <For each={suggestionRows()}>
            {(row, index) => {
              if (row.kind === "empty") {
                return (
                  <text id="ex-command-prompt-suggestions" fg={$theme.token.fgMuted} height={1}>
                    (no suggestions)
                  </text>
                );
              }

              const isSelected = () => index() === clampedSelection();

              return (
                <text
                  id={index() === 0 ? "ex-command-prompt-suggestions" : undefined}
                  fg={$theme.token.fg}
                  height={1}
                >
                  <span
                    style={{
                      fg: isSelected() ? $theme.token.accent : $theme.token.fgMuted,
                    }}
                  >
                    {isSelected() ? "> " : "  "}
                  </span>
                  <span
                    style={{
                      fg: isSelected() ? $theme.token.fg : $theme.token.success,
                      attributes: TextAttributes.BOLD,
                    }}
                  >
                    {row.suggestion.label}
                  </span>
                  <span style={{ fg: $theme.token.border }}>{"  "}</span>
                  <span style={{ fg: $theme.token.fgMuted }}>{row.suggestion.desc}</span>
                </text>
              );
            }}
          </For>
        </box>
      </box>
    </Show>
  );
}
