import { FileItem } from "./file-item";
import type { FileListProps } from "./types";
import { buildFileKey } from "./utils";

export function FileList(props: FileListProps) {
  const {
    title,
    count,
    countColor,
    files,
    section,
    focusedFileKey,
    selectedFileKey,
    onSelectFile,
    theme,
  } = props;

  if (files.length === 0) return null;

  return (
    <box flexDirection="column" paddingBottom={1}>
      <box flexDirection="row" paddingLeft={1} paddingBottom={0}>
        <text content={title} fg={theme.textMuted} attributes={1} selectable={false} />
        <text content=" " selectable={false} />
        <text content={String(count)} fg={countColor} selectable={false} />
      </box>

      {files.map((file) => {
        const key = buildFileKey(section, file.path);
        const isFocused = focusedFileKey === key;
        const isSelected = selectedFileKey === key;

        return (
          <FileItem
            key={key}
            id={key}
            file={file}
            isFocused={isFocused}
            isSelected={isSelected}
            onSelect={() => onSelectFile(file.path, section)}
            theme={theme}
          />
        );
      })}
    </box>
  );
}
