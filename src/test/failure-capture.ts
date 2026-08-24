export interface FailedCaseContext {
  name: string;
  origin: string;
}

const FAILED_ROOT = "examples/failed-tests";
const WRITE_DELAY_MS = 25;
const pendingWrites = new Map<string, { diagram: string; timerId: ReturnType<typeof setTimeout> }>();
let flushHooksInstalled = false;

function isFailedCaseCaptureEnabled(): boolean {
  if (typeof Deno === "undefined") return false;
  try {
    const raw = Deno.env.get("CAPTURE_FAILED_CASES");
    if (!raw) return true;
    const value = raw.trim().toLowerCase();
    return value !== "0" && value !== "false" && value !== "off" && value !== "no";
  } catch {
    // If env access is denied, keep capture on by default.
    return true;
  }
}

function sanitizeSegment(input: string): string {
  const sanitized = input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized : "unnamed";
}

function testFileStem(origin: string): string {
  try {
    const path = decodeURIComponent(new URL(origin).pathname);
    const fileName = path.split("/").pop() ?? "test";
    return fileName.replace(/\.[^.]+$/, "") || "test";
  } catch {
    return "test";
  }
}

function casePath(context: FailedCaseContext): string {
  const group = sanitizeSegment(testFileStem(context.origin));
  const name = sanitizeSegment(context.name);
  return `${FAILED_ROOT}/${group}/${name}.topos`;
}

function parentDir(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "." : path.slice(0, idx);
}

function writeCase(path: string, diagram: string): void {
  Deno.mkdirSync(parentDir(path), { recursive: true });
  Deno.writeTextFileSync(path, diagram);
}

export function flushPendingWrites(): void {
  for (const [path, pending] of pendingWrites.entries()) {
    clearTimeout(pending.timerId);
    try {
      writeCase(path, pending.diagram);
    } catch {
      // Best-effort only.
    }
  }
  pendingWrites.clear();
}

function removeCaseIfExists(path: string): void {
  try {
    Deno.statSync(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return;
    throw err;
  }
  Deno.removeSync(path);
}

function ensureFlushHooks(): void {
  if (flushHooksInstalled) return;
  flushHooksInstalled = true;

  if (typeof globalThis.addEventListener === "function") {
    globalThis.addEventListener("error", () => flushPendingWrites());
    globalThis.addEventListener("unhandledrejection", () => flushPendingWrites());
    globalThis.addEventListener("unload", () => flushPendingWrites());
  }

  // Flush delayed writes at the end of every test, including failed tests.
  Deno.test.afterEach(() => flushPendingWrites());
  Deno.test.afterAll(() => flushPendingWrites());
  // Flush delayed writes at the beginning of next test.
  Deno.test.beforeEach(() => flushPendingWrites());
}

export function captureFailedCase(diagram: string, context?: FailedCaseContext): void {
  if (!context || !isFailedCaseCaptureEnabled() || typeof Deno === "undefined") return;
  ensureFlushHooks();

  const path = casePath(context);
  const prev = pendingWrites.get(path);
  if (prev) clearTimeout(prev.timerId);

  const timerId = setTimeout(() => {
    const pending = pendingWrites.get(path);
    if (!pending) return;
    pendingWrites.delete(path);
    try {
      writeCase(path, pending.diagram);
    } catch {
      // Best-effort only; parser behavior should never depend on failed-case capture.
    }
  }, WRITE_DELAY_MS);

  pendingWrites.set(path, { diagram, timerId });
}

export function testCompleted(context?: FailedCaseContext): void {
  if (!context || !isFailedCaseCaptureEnabled() || typeof Deno === "undefined") return;
  try {
    const path = casePath(context);
    const pending = pendingWrites.get(path);
    if (pending) {
      clearTimeout(pending.timerId);
      pendingWrites.delete(path);
    }
    removeCaseIfExists(path);
  } catch (_err) {
    // Best-effort cleanup only.
  }
}
