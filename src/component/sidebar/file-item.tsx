import type { FileItemProps } from "./types";
import { getFileStatus, getStatusColor, getStatusIcon, splitPath, truncateDir } from "./utils";

export function FileItem(props: FileItemProps) {
  const { file, isFocused, isSelected, onSelect, theme } = props;

  const status = getFileStatus(file);
  const icon = getStatusIcon(status);
  const statusColor = getStatusColor(status, theme);
  const { name, dir } = splitPath(file.path);
  const pathSuffix = dir ? truncateDir(dir, 18) : null;
  // Background: focused (cursor position) vs selected (active diff)
  const bgColor = isFocused
    ? `${theme.accent}16`
    : isSelected
      ? `${theme.accent}08`
      : undefined;

  // Text color: focused gets accent, selected gets status color
  const nameColor = isFocused ? theme.accent : statusColor;

  return (
    <box
      onMouseUp={onSelect}
      flexDirection="row"
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={bgColor}
    >
      <text content={icon} fg={statusColor} selectable={false} />
      <text content=" " selectable={false} />
      <text content={name} fg={nameColor} attributes={isFocused ? 1 : 0} selectable={true} />
      {pathSuffix ? (
        <>
          <text content="  " selectable={false} />
          <text content={pathSuffix} fg={theme.textMuted} selectable={false} />
        </>
      ) : null}
    </box>
  );
}
