import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type CommandOption = {
  id: string;
  label: string;
  description?: string;
  run: () => void;
};

export type CommandPromptState = {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  open: () => void;
  close: () => void;
  setQuery: (value: string) => void;
  setSelectedIndex: (value: number) => void;
};

const CommandPromptContext = createContext<CommandPromptState | null>(null);

export function CommandPromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const value = useMemo<CommandPromptState>(
    () => ({
      isOpen,
      query,
      selectedIndex,
      open: () => {
        setIsOpen(true);
        setQuery("");
        setSelectedIndex(0);
      },
      close: () => {
        setIsOpen(false);
        setQuery("");
        setSelectedIndex(0);
      },
      setQuery: (value: string) => {
        setQuery(value);
        setSelectedIndex(0);
      },
      setSelectedIndex,
    }),
    [isOpen, query, selectedIndex],
  );

  return (
    <CommandPromptContext.Provider value={value}>{children}</CommandPromptContext.Provider>
  );
}

export function useCommandPrompt() {
  const context = useContext(CommandPromptContext);
  if (!context) {
    throw new Error("useCommandPrompt must be used within a CommandPromptProvider");
  }
  return context;
}
