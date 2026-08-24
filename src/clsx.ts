export type ClsxDictionary = Record<string, unknown>;
export type ClsxInput = string | null | undefined | false | ClsxDictionary | Iterable<ClsxInput>;

function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.iterator in value;
}

function appendClsxValue(target: Set<string>, value: ClsxInput): void {
  if (!value) return;

  if (typeof value === "string") {
    target.add(value);
    return;
  }

  if (isIterable(value)) {
    for (const nested of value) appendClsxValue(target, nested as ClsxInput);
    return;
  }

  for (const [key, include] of Object.entries(value)) {
    if (include) target.add(key);
  }
}

export function clsxSet(...values: ClsxInput[]): Set<string> {
  const classes = new Set<string>();
  for (const value of values) appendClsxValue(classes, value);
  return classes;
}

export function appendClsx(target: Set<string>, ...values: ClsxInput[]): Set<string> {
  for (const value of values) appendClsxValue(target, value);
  return target;
}

export function clsx(...values: ClsxInput[]): string {
  return Array.from(clsxSet(...values)).join(" ");
}
