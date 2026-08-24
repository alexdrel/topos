export const SLATE_CONTEXT_COMMANDS = [
  "style",
  "editText",
  "duplicateRight",
  "duplicateDown",
  "toggleContents",
  "delete",
  "createText",
  "createBox",
  "createLine",
  "createHub",
] as const;

export type SlateContextCommand = typeof SLATE_CONTEXT_COMMANDS[number];
