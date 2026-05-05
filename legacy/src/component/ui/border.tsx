export const EmptyBorder = {
  topLeft: "",
  bottomLeft: "",
  vertical: "",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
};

export const SplitBorder = {
  border: ["left" as const, "right" as const],
  customBorderChars: {
    ...EmptyBorder,
    vertical: "\u2503",
  },
};

export const FullBorder = {
  customBorderChars: {
    topLeft: "\u250c",
    topRight: "\u2510",
    bottomLeft: "\u2514",
    bottomRight: "\u2518",
    horizontal: "\u2500",
    vertical: "\u2502",
    topT: "\u252c",
    bottomT: "\u2534",
    leftT: "\u251c",
    rightT: "\u2524",
    cross: "\u253c",
  },
};
