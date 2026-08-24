import { initDropdownMenu, showTemporaryLabel } from "../dom-utils.ts";
import toolbarHtml from "./toolbar.html?raw";

const BLANK_VALUE = "__blank__";
const COMPENDIUM_VALUE = "__compendium__";

type ThemeName = "erebus" | "solarized-dark" | "solarized-light" | "classic" | "monokai";
export type MainView = "slate" | "source" | "svg";

export interface ToolbarConfig {
  getView(): MainView;
  setView(view: MainView): void;
  onNewCase(): void;
  onCaseLoaded(text: string): void;
  onCopyAll(): string;
  onPasteAll(text: string): void;
  renderMonosketch(name: string): string;
}

export interface ToolbarApi {
  refresh(): void;
}

export function initToolbar(config: ToolbarConfig): ToolbarApi {
  const topbar = document.getElementById("topbar") as HTMLElement;
  topbar.innerHTML = toolbarHtml;

  const caseSelect = document.getElementById("case-select") as HTMLSelectElement;
  const reloadCasesBtn = document.getElementById("btn-reload-cases") as HTMLButtonElement;
  const svgFocusBtn = document.getElementById("btn-svg-focus") as HTMLButtonElement;
  const sourceFocusBtn = document.getElementById("btn-source-focus") as HTMLButtonElement;
  const themeMenuBtn = document.getElementById("btn-theme-menu") as HTMLButtonElement;
  const themeMenuContent = document.getElementById("theme-menu-content") as HTMLDivElement;
  const fontMenuBtn = document.getElementById("btn-font-menu") as HTMLButtonElement;
  const fontMenuContent = document.getElementById("font-menu-content") as HTMLDivElement;
  const exportMonoBtn = document.getElementById("btn-export-mono") as HTMLButtonElement;
  let theme = (localStorage.getItem("topos-editor-theme") as ThemeName) || "erebus";
  document.body.dataset.theme = theme;

  const themeMenu = initDropdownMenu(themeMenuBtn, themeMenuContent, () => fontMenu.close());
  const fontMenu = initDropdownMenu(fontMenuBtn, fontMenuContent, () => themeMenu.close());

  exportMonoBtn.addEventListener("click", () => {
    const value = caseSelect.value;
    let name = "diagram";
    if (value === COMPENDIUM_VALUE) name = "compendium";
    else if (value !== BLANK_VALUE) name = (value.split("/").at(-1) ?? name).replace(/\.topos$/i, "");
    const blob = new Blob([config.renderMonosketch(name)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.mono`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });

  function setFont(name: string) {
    document.body.style.setProperty("--editor-font", `'${name}', monospace`);
    localStorage.setItem("topos-editor-font", name);
    globalThis.dispatchEvent(new Event("resize"));
  }

  function updateThemeUI(theme: ThemeName) {
    const displayNames: Record<ThemeName, string> = {
      erebus: "Erebus",
      "solarized-dark": "Solarized Dark",
      "solarized-light": "Solarized Light",
      classic: "Classic",
      monokai: "Monokai",
    };
    themeMenuBtn.querySelector("span")!.textContent = `Theme: ${displayNames[theme]}`;
    themeMenuContent.querySelectorAll<HTMLButtonElement>(".theme-option-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === theme);
    });
  }

  function updateFontUI(font: string) {
    fontMenuBtn.querySelector("span")!.textContent = `Font: ${font}`;
    fontMenuContent.querySelectorAll<HTMLButtonElement>(".font-option-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === font);
    });
  }

  function refresh() {
    const view = config.getView();
    svgFocusBtn.classList.toggle("active", view === "svg");
    svgFocusBtn.setAttribute("aria-pressed", String(view === "svg"));
    sourceFocusBtn.classList.toggle("active", view === "source");
    sourceFocusBtn.setAttribute("aria-pressed", String(view === "source"));
    updateThemeUI(theme);
  }

  themeMenuContent.querySelectorAll<HTMLButtonElement>(".theme-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      theme = btn.dataset.value as ThemeName;
      document.body.dataset.theme = theme;
      localStorage.setItem("topos-editor-theme", theme);
      globalThis.dispatchEvent(new Event("topos-theme-change"));
      themeMenu.close();
      refresh();
    });
  });

  fontMenuContent.querySelectorAll<HTMLButtonElement>(".font-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const font = btn.dataset.value || "JuliaMono";
      setFont(font);
      updateFontUI(font);
      fontMenu.close();
    });
  });

  function updateReloadButton() {
    reloadCasesBtn.textContent = caseSelect.value === BLANK_VALUE ? "Clear" : "Reload File";
  }

  async function loadCaseText(casePath: string): Promise<string> {
    const encodedPath = casePath.split("/").map(encodeURIComponent).join("/");
    const url = casePath === COMPENDIUM_VALUE ? "/__topos/compendium" : `/__topos/cases/${encodedPath}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`failed ${response.status}`);
    return await response.text();
  }

  function parseCaseOption(path: string): { scope: "examples" | "failed"; label: string } {
    const segments = path.replace(/^\/+/, "").split("/");
    const scope = segments[0] === "failed-tests" ? "failed" : "examples";
    const stem = (segments.at(-1) ?? "diagram.topos").replace(/\.topos$/i, "");
    if (scope === "failed") {
      const suite = (segments[1] ?? "").replace(/\.test$/i, "");
      return { scope, label: suite ? `[failed] ${suite}: ${stem}` : `[failed] ${stem}` };
    }
    const parent = segments.slice(0, -1).join("/");
    return { scope, label: parent ? `${parent}: ${stem}` : stem };
  }

  async function loadCaseLibrary() {
    const previous = caseSelect.value;
    caseSelect.replaceChildren();
    const blank = document.createElement("option");
    blank.value = BLANK_VALUE;
    blank.textContent = "Blank";
    caseSelect.appendChild(blank);
    const compendium = document.createElement("option");
    compendium.value = COMPENDIUM_VALUE;
    compendium.textContent = "Compendium";
    caseSelect.appendChild(compendium);
    caseSelect.value = previous === COMPENDIUM_VALUE ? previous : BLANK_VALUE;
    updateReloadButton();

    const response = await fetch("/__topos/cases/", { cache: "no-store" });
    if (!response.ok) return;
    const paths = (await response.json()) as string[];
    const entries = paths.map((path) => ({ id: path, ...parseCaseOption(path) })).sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === "failed" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    for (const entry of entries) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      caseSelect.appendChild(option);
    }
    caseSelect.value = previous === BLANK_VALUE || previous === COMPENDIUM_VALUE || entries.some((entry) => entry.id === previous) ? previous : BLANK_VALUE;
    updateReloadButton();
  }

  async function reloadCurrentCase() {
    if (caseSelect.value === BLANK_VALUE) {
      config.onNewCase();
    } else {
      config.onCaseLoaded(await loadCaseText(caseSelect.value));
    }
    await loadCaseLibrary();
  }

  reloadCasesBtn.addEventListener("click", () => {
    void reloadCurrentCase().catch((error) => {
      console.error(error);
      alert("Failed to reload case file.");
    });
  });

  caseSelect.addEventListener("change", () => {
    updateReloadButton();
    if (caseSelect.value === BLANK_VALUE) {
      config.onNewCase();
      caseSelect.blur();
      return;
    }
    void loadCaseText(caseSelect.value).then((text) => {
      config.onCaseLoaded(text);
      caseSelect.blur();
    }).catch((error) => {
      console.error(error);
      alert("Failed to load case.");
    });
  });

  svgFocusBtn.addEventListener("click", () => {
    config.setView(config.getView() === "svg" ? "slate" : "svg");
    refresh();
  });
  sourceFocusBtn.addEventListener("click", () => {
    config.setView(config.getView() === "source" ? "slate" : "source");
    refresh();
  });

  const copyAllBtn = document.getElementById("btn-copy-all") as HTMLButtonElement;
  copyAllBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(config.onCopyAll()).then(() => {
      showTemporaryLabel(copyAllBtn, "Copied!", "success");
    }).catch((error) => console.error("Clipboard copy failed:", error));
  });
  const pasteAllBtn = document.getElementById("btn-paste-all") as HTMLButtonElement;
  pasteAllBtn.addEventListener("click", () => {
    navigator.clipboard.readText().then((text) => {
      config.onPasteAll(text);
      showTemporaryLabel(pasteAllBtn, "Pasted!", "success");
    }).catch((error) => console.error("Clipboard paste failed:", error));
  });

  const font = localStorage.getItem("topos-editor-font") || "JuliaMono";
  setFont(font);
  updateFontUI(font);
  refresh();
  void loadCaseLibrary().catch((error) => console.error("Failed to load case library:", error));

  return { refresh };
}
