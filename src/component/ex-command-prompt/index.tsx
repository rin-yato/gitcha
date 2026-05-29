import type { InputRenderable, Renderable, ScrollBoxRenderable } from "@opentui/core";
import { useBindings, useKeymap, useKeymapSelector } from "@opentui/keymap/solid";
import { useRenderer } from "@opentui/solid";

import { batch, createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";

import { git } from "@/lib/git";
import {
  getGitExCommandInput,
  isGitExCommandParseError,
  runGitExCommand,
} from "@/lib/git/ex-command";

import { Result } from "better-result";

import { createAppExCommands } from "./app-commands";
import { EX_PROMPT_BODY_WIDTH, EX_PROMPT_OUTPUT_ROWS, EX_PROMPT_WIDTH } from "./constants";
import {
  applyExPromptSuggestionFromList,
  getExPromptCommandText,
  getExPromptSuggestions,
  getSelectedExPromptSuggestionFromList,
  moveExPromptSelectionInList,
  parseExPromptInput,
} from "./ex-command-input";
import {
  appendGitOutput,
  buildGitOutputRows,
  completeGitOutput,
  failGitOutput,
  formatGitCommand,
  type GitOutputState,
} from "./git-output";
import { GitOutputView } from "./git-output-view";
import { PromptInput } from "./prompt-input";
import { SuggestionList, type SuggestionRow } from "./suggestion-list";
import { useDialog } from "@/context/dialog";
import { useExCommand } from "@/context/ex-command";
import { useGit } from "@/context/git";
import { useSidebar } from "@/context/sidebar";
import { useTheme } from "@/context/theme";
import { useToast } from "@/context/toast";

export function ExCommandPrompt() {
  const renderer = useRenderer();
  const manager = useKeymap();
  const dialog = useDialog();
  const exCommand = useExCommand();
  const theme = useTheme();
  const gitStore = useGit();
  const toast = useToast();
  const sidebar = useSidebar();

  let inputRef: InputRenderable | undefined;
  let outputScrollRef: ScrollBoxRenderable | undefined;
  let restoreTarget: Renderable | undefined;

  const [target, setTarget] = createSignal<InputRenderable | undefined>(undefined);
  const [value, setValue] = createSignal("");
  const [selection, setSelection] = createSignal(0);
  const [gitOutput, setGitOutput] = createSignal<GitOutputState | null>(null);

  const resetRefs = () => {
    inputRef = undefined;
    outputScrollRef = undefined;
  };

  const resetPromptState = () => {
    batch(() => {
      setValue("");
      setSelection(0);
      setGitOutput(null);
      setTarget(undefined);
    });
    resetRefs();
  };

  const close = () => {
    batch(() => {
      exCommand.close();
      setValue("");
      setSelection(0);
      setGitOutput(null);
      setTarget(undefined);
    });
    resetRefs();
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
    if (exCommand.state.visible) return;

    restoreTarget = renderer.currentFocusedRenderable ?? undefined;
    resetPromptState();
    exCommand.open();
  };

  const syncInput = (nextValue: string) => {
    if (!inputRef) return;

    if (inputRef.value !== nextValue) {
      inputRef.value = nextValue;
    }

    inputRef.cursorOffset = nextValue.length;
  };

  const executeGitCommand = async (raw: string) => {
    const input = getGitExCommandInput(raw);
    const command = formatGitCommand(input);

    batch(() => {
      setSelection(0);
      setGitOutput({ command, status: "running", stdout: "", stderr: "" });
    });

    const result = await runGitExCommand(input, git, {
      onStdout: (text) => {
        setGitOutput((current) => appendGitOutput(current, command, "stdout", text));
      },
      onStderr: (text) => {
        setGitOutput((current) => appendGitOutput(current, command, "stderr", text));
      },
    });

    if (Result.isOk(result)) {
      await gitStore.refresh();
      setGitOutput((current) => completeGitOutput(current, command, result.value.output));
      toast.success(`${command} completed`);
      return;
    }

    if (!isGitExCommandParseError(result.error)) {
      await gitStore.refresh();
    }

    setGitOutput((current) => failGitOutput(current, command, result.error));
    toast.error(`${command} failed`);
  };

  const offExCommands = manager.registerLayer({
    commands: createAppExCommands({
      renderer,
      executeGitCommand,
      refresh: () => gitStore.refresh(),
      notify: (msg) => toast.success(msg),
      toggleSidebar: () => sidebar.toggle(),
    }).map((command) => ({
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
  const outputRows = createMemo(() => buildGitOutputRows(gitOutput()));
  const outputRowsHeight = createMemo(() =>
    Math.min(outputRows().length, EX_PROMPT_OUTPUT_ROWS),
  );
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
    if (gitOutput()) {
      outputScrollRef?.scrollBy(direction);
      return;
    }

    setSelection((current) => moveExPromptSelectionInList(suggestions(), current, direction));
  };

  const pageOutput = (direction: 1 | -1) => {
    if (!gitOutput()) return;

    outputScrollRef?.scrollBy(direction, "viewport");
  };

  const scrollOutputTo = (position: "top" | "bottom") => {
    if (!gitOutput() || !outputScrollRef) return;

    outputScrollRef.scrollTo(position === "top" ? 0 : outputScrollRef.scrollHeight);
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
      setGitOutput(null);
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
        toast.error(`Unknown ex command ${parsed.name}`);
        return;
      }

      if (result.reason === "invalid-args") {
        toast.warning(
          `Usage: ${result.command ? (getExPromptCommandText(result.command, "usage") ?? parsed.name) : parsed.name}`,
        );
        return;
      }

      toast.error(`Command ${parsed.name} failed`);
      return;
    }

    if (parsed.name === ":git") return;

    closeAndRestore();
  };

  useBindings(() => ({
    enabled: () => dialog.state.stack.length === 0 && !exCommand.state.visible,
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
    enabled: () => exCommand.state.visible,
    commands: [
      { name: "ex-command.close", run: closeAndRestore },
      { name: "ex-command.prev", run: () => moveSelection(-1) },
      { name: "ex-command.next", run: () => moveSelection(1) },
      { name: "ex-command.page-up", run: () => pageOutput(-1) },
      { name: "ex-command.page-down", run: () => pageOutput(1) },
      { name: "ex-command.scroll-top", run: () => scrollOutputTo("top") },
      { name: "ex-command.scroll-bottom", run: () => scrollOutputTo("bottom") },
      { name: "ex-command.complete", run: () => applySuggestion() },
      { name: "ex-command.complete-prev", run: () => applySuggestion(-1) },
      { name: "ex-command.submit", run: execute },
    ],
    bindings: [
      { key: "escape", cmd: "ex-command.close", desc: "Close ex command prompt" },
      { key: "up", cmd: "ex-command.prev", desc: "Previous suggestion" },
      { key: "down", cmd: "ex-command.next", desc: "Next suggestion" },
      { key: "ctrl+p", cmd: "ex-command.prev", desc: "Previous suggestion" },
      { key: "ctrl+n", cmd: "ex-command.next", desc: "Next suggestion" },
      { key: "pageup", cmd: "ex-command.page-up", desc: "Scroll output up" },
      { key: "pagedown", cmd: "ex-command.page-down", desc: "Scroll output down" },
      { key: "home", cmd: "ex-command.scroll-top", desc: "Scroll output top" },
      { key: "end", cmd: "ex-command.scroll-bottom", desc: "Scroll output bottom" },
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
    if (!exCommand.state.visible) return;

    const input = target();
    if (!input || input.isDestroyed) return;

    input.focus();
  });

  createEffect<string | null>((previousCommand) => {
    const command = gitOutput()?.command ?? null;
    if (command && command !== previousCommand) {
      outputScrollRef?.scrollTo(0);
    }

    return command;
  });

  onCleanup(() => {
    offExCommands();
  });

  return (
    <Show when={exCommand.state.visible}>
      <box
        id="ex-command-prompt-backdrop"
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
        backgroundColor="#00000077"
        zIndex={3500}
        onMouseUp={(event) => {
          if (event.target?.id === "ex-command-prompt-backdrop") {
            closeAndRestore();
          }
        }}
      >
        <box
          id="ex-command-prompt-shell"
          width={EX_PROMPT_WIDTH}
          backgroundColor={theme.state.token.surface}
          flexDirection="column"
          border
          borderStyle="single"
          borderColor={`${theme.state.token.accent}cc`}
        >
          <box
            id="ex-command-prompt"
            width={EX_PROMPT_BODY_WIDTH}
            backgroundColor={theme.state.token.surface}
            paddingX={1}
            paddingY={0}
            flexDirection="column"
            title=" Ex Command "
            titleAlignment="center"
          >
            <PromptInput
              value={value}
              usage={usage}
              hasSuggestion={() => selectedSuggestion() !== null}
              setInputRef={(input) => {
                inputRef = input;
                setTarget(input);
              }}
              onInput={(nextValue) => {
                batch(() => {
                  setValue(nextValue);
                  setSelection(0);
                  const currentOutput = gitOutput();
                  if (currentOutput?.status !== "running") {
                    setGitOutput(null);
                  }
                });
              }}
            />
          </box>

          <box border={["top"]} borderColor={`${theme.state.token.border}66`}>
            <Show
              when={gitOutput()}
              fallback={
                <SuggestionList rows={suggestionRows} selectedIndex={clampedSelection} />
              }
            >
              <GitOutputView
                rows={outputRows}
                height={outputRowsHeight}
                setScrollRef={(scroll) => {
                  outputScrollRef = scroll;
                  scroll.scrollTo(0);
                }}
              />
            </Show>
          </box>
        </box>
      </box>
    </Show>
  );
}
