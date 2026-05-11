export type ExArgCount = "0" | "1" | "?" | "*" | "+";

export type ExPromptCommand = {
  name?: unknown;
  aliases?: unknown;
  nargs?: unknown;
  usage?: unknown;
  desc?: unknown;
  title?: unknown;
};

export type ExPromptSuggestion = {
  label: string;
  insert: string;
  usage: string;
  desc: string;
  expectsArgs: boolean;
};

export type ParsedExPromptInput = {
  raw: string;
  name: string;
  args: string[];
};

export const EX_PROMPT_MAX_VISIBLE_SUGGESTIONS = 4;

export function normalizeExPromptName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return ":";

  return trimmed.startsWith(":") ? trimmed : `:${trimmed}`;
}

export function parseExPromptInput(input: string): ParsedExPromptInput | null {
  const normalized = normalizeExPromptName(input);
  if (normalized === ":") return null;

  const parts = normalized.split(/\s+/);
  const [name, ...args] = parts;
  if (!name) return null;

  return {
    raw: normalized,
    name,
    args,
  };
}

export function getExPromptCommandText(
  command: ExPromptCommand,
  fieldName: "usage" | "desc" | "title",
): string | undefined {
  return getMetadataText(command[fieldName]);
}

export function getExPromptCommandNargs(command: ExPromptCommand): ExArgCount | undefined {
  const value = command.nargs;
  if (value === "0" || value === "1" || value === "?" || value === "*" || value === "+") {
    return value;
  }

  return undefined;
}

export function buildExPromptSuggestions(
  commands: readonly ExPromptCommand[],
): ExPromptSuggestion[] {
  const seen = new Set<string>();
  const suggestions: ExPromptSuggestion[] = [];

  for (const command of commands) {
    const labels = getExPromptCommandLabels(command);
    for (const label of labels) {
      if (seen.has(label)) continue;

      seen.add(label);
      suggestions.push({
        label,
        insert: label,
        usage: getExPromptCommandText(command, "usage") ?? label,
        desc:
          getExPromptCommandText(command, "desc") ??
          getExPromptCommandText(command, "title") ??
          "",
        expectsArgs: getExPromptCommandNargs(command) !== "0",
      });
    }
  }

  return suggestions;
}

export function getExPromptSuggestions(
  commands: readonly ExPromptCommand[],
  value: string,
  limit = EX_PROMPT_MAX_VISIBLE_SUGGESTIONS,
): ExPromptSuggestion[] {
  const query = getExPromptQuery(value);
  const suggestions = buildExPromptSuggestions(commands);

  if (!query) return suggestions.slice(0, limit);

  return suggestions
    .filter((suggestion) => matchesExPromptQuery(suggestion, query))
    .slice(0, limit);
}

export function getExPromptSuggestionRowCount(
  suggestions: readonly ExPromptSuggestion[],
): number {
  return Math.max(suggestions.length, 1);
}

export function getSelectedExPromptSuggestion(
  commands: readonly ExPromptCommand[],
  value: string,
  selection: number,
): ExPromptSuggestion | null {
  return getSelectedExPromptSuggestionFromList(
    getExPromptSuggestions(commands, value),
    selection,
  );
}

export function getSelectedExPromptSuggestionFromList(
  suggestions: readonly ExPromptSuggestion[],
  selection: number,
): ExPromptSuggestion | null {
  if (suggestions.length === 0) return null;

  return suggestions[Math.min(selection, suggestions.length - 1)] ?? null;
}

export function moveExPromptSelection(
  commands: readonly ExPromptCommand[],
  value: string,
  selection: number,
  direction: 1 | -1,
): number {
  return moveExPromptSelectionInList(
    getExPromptSuggestions(commands, value),
    selection,
    direction,
  );
}

export function moveExPromptSelectionInList(
  suggestions: readonly ExPromptSuggestion[],
  selection: number,
  direction: 1 | -1,
): number {
  if (suggestions.length === 0) return 0;

  const current = Math.min(selection, suggestions.length - 1);
  return (current + direction + suggestions.length) % suggestions.length;
}

export function applyExPromptSuggestion(
  commands: readonly ExPromptCommand[],
  value: string,
  selection: number,
  direction?: 1 | -1,
): { value: string; selection: number } | null {
  return applyExPromptSuggestionFromList(
    getExPromptSuggestions(commands, value),
    value,
    selection,
    direction,
  );
}

export function applyExPromptSuggestionFromList(
  suggestions: readonly ExPromptSuggestion[],
  value: string,
  selection: number,
  direction?: 1 | -1,
): { value: string; selection: number } | null {
  if (suggestions.length === 0) return null;

  const nextSelection = direction
    ? moveExPromptSelectionInList(suggestions, selection, direction)
    : Math.min(selection, suggestions.length - 1);
  const suggestion = suggestions[nextSelection];
  if (!suggestion) return null;

  const normalized = normalizeExPromptName(value);
  const spaceIndex = normalized.indexOf(" ");
  const rest = spaceIndex === -1 ? "" : normalized.slice(spaceIndex + 1).trimStart();
  const nextValue = rest
    ? `${suggestion.insert} ${rest}`
    : suggestion.expectsArgs
      ? `${suggestion.insert} `
      : suggestion.insert;

  return {
    value: nextValue,
    selection: nextSelection,
  };
}

function getExPromptCommandLabels(command: ExPromptCommand): string[] {
  const name = getMetadataText(command.name);
  const aliases = Array.isArray(command.aliases)
    ? command.aliases.flatMap((alias) => {
        const text = getMetadataText(alias);
        return text ? [text] : [];
      })
    : [];

  return [name, ...aliases].flatMap((label) => (label ? [toBareExPromptName(label)] : []));
}

function getExPromptQuery(value: string): string {
  const trimmed = value.trimStart();
  const bare = trimmed.startsWith(":") ? trimmed.slice(1) : trimmed;
  const spaceIndex = bare.indexOf(" ");
  return spaceIndex === -1 ? bare : bare.slice(0, spaceIndex);
}

function matchesExPromptQuery(suggestion: ExPromptSuggestion, query: string): boolean {
  return suggestion.label.startsWith(query);
}

function toBareExPromptName(name: string): string {
  return normalizeExPromptName(name).slice(1);
}

function getMetadataText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}
