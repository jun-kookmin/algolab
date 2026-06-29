"use client";

export type VditorInstance = {
  getValue: () => string;
  setValue: (value: string) => void;
  insertValue: (value: string) => void;
  destroy: () => void;
};

export type VditorClass = {
  new (element: HTMLElement, options: Record<string, unknown>): VditorInstance;
  preview: (
    element: HTMLElement,
    markdown: string,
    options?: Record<string, unknown>
  ) => void;
};

type WindowWithVditor = Window & {
  Vditor?: VditorClass;
  katex?: unknown;
  define?: ((...args: unknown[]) => unknown) & { amd?: unknown };
  require?: (...args: unknown[]) => unknown;
};

const STYLE_ID = "vditor-style";
const SCRIPT_ID = "vditor-script";
const KATEX_STYLE_ID = "katex-style";
const KATEX_SCRIPT_ID = "katex-script";
const KATEX_MHCHEM_SCRIPT_ID = "katex-mhchem-script";
const VDITOR_VERSION = "3.11.1";
const KATEX_VERSION = "0.16.11";
const VDITOR_STYLE_URL = `https://cdn.jsdelivr.net/npm/vditor@${VDITOR_VERSION}/dist/index.css`;
const VDITOR_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/vditor@${VDITOR_VERSION}/dist/index.min.js`;
const KATEX_STYLE_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
const KATEX_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`;
const KATEX_MODULE_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.mjs`;
const KATEX_MHCHEM_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/mhchem.min.js`;
let cachedVditor: VditorClass | null = null;
let loadingPromise: Promise<VditorClass> | null = null;
let katexLoadingPromise: Promise<boolean> | null = null;

const runWithoutAmdGlobal = async <T>(
  runner: () => Promise<T>,
): Promise<T> => {
  const w = window as WindowWithVditor;
  const originalDefine = w.define;
  const originalRequire = w.require;
  const hasAmdDefine =
    typeof originalDefine === "function" &&
    Object.prototype.hasOwnProperty.call(originalDefine, "amd");

  if (!hasAmdDefine) {
    return runner();
  }

  try {
    // Monaco AMD loader가 존재할 때 UMD 스크립트(Vditor/KaTeX)가
    // AMD 경로를 타며 충돌하는 것을 막기 위해 로드 시점에만 비활성화한다.
    w.define = undefined;
    w.require = undefined;
    return await runner();
  } finally {
    w.define = originalDefine;
    w.require = originalRequire;
  }
};

const ensureVditorStyle = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = VDITOR_STYLE_URL;
  document.head.appendChild(link);
};

const ensureKatexStyle = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(KATEX_STYLE_ID)) return;

  const link = document.createElement("link");
  link.id = KATEX_STYLE_ID;
  link.rel = "stylesheet";
  link.href = KATEX_STYLE_URL;
  document.head.appendChild(link);
};

const loadKatexFromCdn = async (): Promise<void> => {
  ensureKatexStyle();
  const w = window as WindowWithVditor;
  if (w.katex) return;

  await runWithoutAmdGlobal(() => new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(KATEX_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("KaTeX CDN load failed")), {
        once: true,
      });
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = KATEX_SCRIPT_ID;
    script.src = KATEX_SCRIPT_URL;
    script.async = false;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error("KaTeX CDN load failed"));
    document.body.appendChild(script);
  }));
};

const loadKatexFromModule = async (): Promise<boolean> => {
  try {
    const katexModule = (await import(/* webpackIgnore: true */ KATEX_MODULE_URL)) as {
      default?: unknown;
    };
    const katex = katexModule.default ?? katexModule;
    if (!katex) return false;
    (window as WindowWithVditor).katex = katex;
    return true;
  } catch {
    return false;
  }
};

const loadKatexMhchemFromCdn = async (): Promise<void> => {
  await runWithoutAmdGlobal(() => new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(KATEX_MHCHEM_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("KaTeX mhchem CDN load failed")), {
        once: true,
      });
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = KATEX_MHCHEM_SCRIPT_ID;
    script.src = KATEX_MHCHEM_SCRIPT_URL;
    script.async = false;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error("KaTeX mhchem CDN load failed"));
    document.body.appendChild(script);
  }));
};

export const ensureKatex = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  const w = window as WindowWithVditor;
  if (w.katex) return true;
  if (katexLoadingPromise) return katexLoadingPromise;

  katexLoadingPromise = (async () => {
    ensureKatexStyle();
    if (await loadKatexFromModule()) {
      await loadKatexMhchemFromCdn();
      return true;
    }

    try {
      await loadKatexFromCdn();
      await loadKatexMhchemFromCdn();
      return Boolean((window as WindowWithVditor).katex);
    } catch {
      return false;
    }
  })();

  try {
    return await katexLoadingPromise;
  } finally {
    katexLoadingPromise = null;
  }
};

const loadFromCdn = async (): Promise<VditorClass> => {
  ensureVditorStyle();
  const w = window as WindowWithVditor;
  if (w.Vditor) return w.Vditor;

  await runWithoutAmdGlobal(() => new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Vditor CDN load failed")), {
        once: true,
      });
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = VDITOR_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error("Vditor CDN load failed"));
    document.body.appendChild(script);
  }));

  if (!w.Vditor) {
    throw new Error("Vditor is not available on window after CDN load");
  }
  return w.Vditor;
};

export const loadVditor = async (): Promise<VditorClass> => {
  if (cachedVditor) return cachedVditor;
  if (loadingPromise) return loadingPromise;
  if (typeof window === "undefined") {
    throw new Error("window is not available");
  }

  loadingPromise = (async () => {
    try {
      // Prefer installed npm module to avoid window global dependency.
      const imported = await import("vditor");
      const ctor = ((imported as unknown as { default?: unknown }).default ??
        imported) as unknown;
      if (typeof ctor === "function") {
        cachedVditor = ctor as VditorClass;
        return cachedVditor;
      }
    } catch {
      // console.warn("[vditorLoader] npm import failed, fallback to CDN:", err);
    }

    cachedVditor = await loadFromCdn();
    return cachedVditor;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
};
