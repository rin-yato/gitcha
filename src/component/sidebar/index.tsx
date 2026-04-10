export * from "./file-item";
export * from "./file-list";
export * from "./types";
export * from "./utils";

import type { FileSection, ViewMode } from "../../context/changes/state";
import type { Theme } from "../../context/theme/provider";
import type { CompareState, GitRepoStatus, GitStatusFile } from "../../git";
import { FileList } from "./file-list";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarProps = {
  theme: Theme;
  status: GitRepoStatus | null;
  error: string | null;
  selectedFileKey: string | null;
  focusedFileKey: string | null;
  selectFile: (path: string, section: FileSection) => void;
  viewMode: ViewMode;
  compareState: CompareState | null;
  width: number;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function getStagedFiles(status: GitRepoStatus | null): GitStatusFile[] {
  return status?.files.staged ?? [];
}

function getChangeFiles(status: GitRepoStatus | null): GitStatusFile[] {
  if (!status) return [];
  return [...status.files.changes, ...status.files.untracked];
}

function getCompareFiles(compareState: CompareState | null): GitStatusFile[] {
  return compareState?.files ?? [];
}

function isEmptyRepo(status: GitRepoStatus | null): boolean {
  if (!status?.isRepo) return true;
  return status.totalFiles === 0;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Header(props: { viewMode: ViewMode; baseLabel: string | null; theme: Theme }) {
  const { viewMode, baseLabel, theme } = props;

  const title = viewMode === "staging" ? "Staging" : `Compare · ${baseLabel ?? "?"}`;
  const hint = viewMode === "staging" ? "[v]" : "[v] staging";

  return (
    <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
      <text
        content={title}
        fg={viewMode === "compare" ? theme.accent : theme.text}
        attributes={1}
        selectable={false}
      />
      <text content={hint} fg={theme.textMuted} selectable={false} />
    </box>
  );
}

function ErrorMessage(props: { error: string; theme: Theme }) {
  return (
    <box paddingLeft={1}>
      <text content={props.error} fg={props.theme.error} selectable={false} />
    </box>
  );
}

function EmptyState(props: { viewMode: ViewMode; baseLabel: string | null; theme: Theme }) {
  const { viewMode, baseLabel, theme } = props;

  const message =
    viewMode === "staging" ? "Working tree clean" : `No changes vs ${baseLabel ?? "base"}`;

  return (
    <box paddingLeft={1}>
      <text content={message} fg={theme.textMuted} selectable={false} />
    </box>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------

export function Sidebar(props: SidebarProps) {
  const {
    theme,
    status,
    error,
    selectedFileKey,
    focusedFileKey,
    selectFile,
    viewMode,
    compareState,
    width,
  } = props;

  const staged = getStagedFiles(status);
  const changes = getChangeFiles(status);
  const compareFiles = getCompareFiles(compareState);
  const isEmpty = isEmptyRepo(status);

  return (
    <box backgroundColor={theme.surface} width={width} flexDirection="column" paddingY={1}>
      <Header viewMode={viewMode} baseLabel={compareState?.baseLabel ?? null} theme={theme} />

      <scrollbox>
        {error ? <ErrorMessage error={error} theme={theme} /> : null}

        {/* Compare file list */}
        {viewMode === "compare" ? (
          compareFiles.length > 0 ? (
            <FileList
              title="Changes"
              count={compareFiles.length}
              countColor={theme.modified}
              files={compareFiles}
              section="compare"
              focusedFileKey={focusedFileKey}
              selectedFileKey={selectedFileKey}
              onSelectFile={selectFile}
              theme={theme}
            />
          ) : (
            <EmptyState
              viewMode="compare"
              baseLabel={compareState?.baseLabel ?? null}
              theme={theme}
            />
          )
        ) : null}

        {/* Staging view */}
        {viewMode === "staging" ? (
          isEmpty ? (
            <EmptyState viewMode="staging" baseLabel={null} theme={theme} />
          ) : (
            <>
              <FileList
                title="Staged"
                count={staged.length}
                countColor={theme.added}
                files={staged}
                section="staged"
                focusedFileKey={focusedFileKey}
                selectedFileKey={selectedFileKey}
                onSelectFile={selectFile}
                theme={theme}
              />
              <FileList
                title="Changes"
                count={changes.length}
                countColor={theme.modified}
                files={changes}
                section="changes"
                focusedFileKey={focusedFileKey}
                selectedFileKey={selectedFileKey}
                onSelectFile={selectFile}
                theme={theme}
              />
            </>
          )
        ) : null}
      </scrollbox>
    </box>
  );
}
