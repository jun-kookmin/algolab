"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ensureKatex, loadVditor } from "@/utils/vditorLoader";
import {
  composeDescriptionWithImageRefs,
  splitDescriptionAndImageRefs,
} from "@/utils/problemMarkdownImageRefs";

interface VditorPreviewProps {
  content: string;
  theme?: "dark" | "light";
  className?: string;
  disableMath?: boolean;
}

type KatexGlobal = {
  renderToString: (
    expression: string,
    options: {
      displayMode: boolean;
      output: "html";
      throwOnError: boolean;
      macros?: Record<string, string>;
    },
  ) => string;
};

const getKatex = (): KatexGlobal | null => {
  if (typeof window === "undefined") return null;
  const katex = (window as Window & { katex?: KatexGlobal }).katex;
  return katex ?? null;
};

const renderMathWithKatex = (root: HTMLElement) => {
  const katex = getKatex();
  if (!katex) return;

  root.querySelectorAll<HTMLElement>(".language-math").forEach((mathElement) => {
    const storedSource = mathElement.getAttribute("data-math-source");
    const currentRaw = storedSource ?? mathElement.getAttribute("data-math") ?? mathElement.textContent ?? "";
    const mathExpression = currentRaw.replace(/\u00a0/g, " ").trim();
    if (!mathExpression) return;

    if (storedSource !== mathExpression) {
      mathElement.setAttribute("data-math-source", mathExpression);
    }

    try {
      mathElement.innerHTML = katex.renderToString(mathExpression, {
        displayMode: mathElement.tagName === "DIV",
        output: "html",
        throwOnError: false,
      });
      mathElement.setAttribute("data-math", mathExpression);
      mathElement.classList.remove("vditor-reset--error");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Math render failed";
      mathElement.textContent = message;
      mathElement.classList.add("vditor-reset--error");
    }
  });
};

const normalizeLatexDelimiters = (markdown: string) => {
  const segments = markdown.split(/(```[\s\S]*?```)/g);

  return segments
    .map((segment) => {
      if (segment.startsWith("```")) {
        return segment;
      }

      return segment
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr: string) => `$$\n${expr}\n$$`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr: string) => `$${expr}$`);
    })
    .join("");
};

const optimizePreviewImages = (root: HTMLElement) => {
  root.querySelectorAll("img").forEach((img) => {
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    img.style.display = "block";
    img.style.width = "100%";
    img.style.maxWidth = "100%";
    img.style.maxInlineSize = "100%";
    img.style.height = "auto";
    img.style.objectFit = "contain";
  });
};

const dataUrlToBlob = (dataUrl: string): Blob | null => {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return null;

  const header = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/^data:([^;]+)(;base64)?$/i);
  if (!mimeMatch) return null;

  const mimeType = mimeMatch[1] ?? "application/octet-stream";
  const isBase64 = Boolean(mimeMatch[2]);

  try {
    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    }

    const text = decodeURIComponent(payload);
    return new Blob([text], { type: mimeType });
  } catch {
    return null;
  }
};

const VditorPreview: React.FC<VditorPreviewProps> = ({
  content,
  theme = "dark",
  className = "",
  disableMath = false,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());

  const resolveRenderableImageRef = useCallback((refValue: string) => {
    if (!refValue.startsWith("data:image/")) {
      return refValue;
    }

    const cached = blobUrlCacheRef.current.get(refValue);
    if (cached) return cached;

    const blob = dataUrlToBlob(refValue);
    if (!blob) return refValue;

    const blobUrl = URL.createObjectURL(blob);
    blobUrlCacheRef.current.set(refValue, blobUrl);
    return blobUrl;
  }, []);

  useEffect(() => {
    const cache = blobUrlCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  useEffect(() => {
    if (loadFailed) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    (async () => {
      try {
        // Vditor 내부 math 로더는 AMD(Monaco) 환경과 충돌할 수 있어 사용하지 않는다.
        // KaTeX는 별도 로더로 선로딩 후 preview 결과의 math 블록을 직접 렌더링한다.
        const allowMath = !disableMath;
        const katexReady = allowMath ? await ensureKatex() : false;
        const Vditor = await loadVditor();
        if (cancelled || !rootRef.current) return;

        rootRef.current.innerHTML = "";
        const parsed = splitDescriptionAndImageRefs(content ?? "");
        const normalizedBody = normalizeLatexDelimiters(parsed.body);
        const usedDataRefs = new Set<string>();
        const renderableRefs = Object.fromEntries(
          Object.entries(parsed.imageRefs).map(([alias, refValue]) => {
            if (refValue.startsWith("data:image/")) {
              usedDataRefs.add(refValue);
            }
            return [alias, resolveRenderableImageRef(refValue)];
          }),
        );

        blobUrlCacheRef.current.forEach((url, key) => {
          if (!usedDataRefs.has(key)) {
            URL.revokeObjectURL(url);
            blobUrlCacheRef.current.delete(key);
          }
        });

        const normalizedContent = composeDescriptionWithImageRefs(
          normalizedBody,
          renderableRefs,
          { pruneUnused: false },
        );
        const renderPreview = () => {
          if (cancelled || !rootRef.current) return;
          Vditor.preview(rootRef.current, normalizedContent, {
            mode: theme,
            theme: { current: theme },
            // Vditor 기본 math 로더(KaTeX/mhchem script 주입)를 비활성화한다.
            // 실제 수식 렌더링은 renderMathWithKatex()에서 직접 처리한다.
            math: { engine: "__disabled__", inlineDigit: true, macros: {} },
            hljs: { lineNumber: false },
          });
          if (allowMath && katexReady) {
            renderMathWithKatex(rootRef.current);
          }
          optimizePreviewImages(rootRef.current);
        };

        // 초기 DOM 페인팅 타이밍 차이로 인한 수식 누락을 줄이기 위해
        // preview 1회 후 math 렌더만 한 번 더 보정한다.
        renderPreview();
        if (allowMath && katexReady && typeof window !== "undefined") {
          rafId = window.requestAnimationFrame(() => {
            if (cancelled || !rootRef.current) return;
            renderMathWithKatex(rootRef.current);
          });
          timeoutId = setTimeout(() => {
            if (cancelled || !rootRef.current) return;
            renderMathWithKatex(rootRef.current);
          }, 120);
        }
      } catch {
        // console.error("[VditorPreview] render failed:", err);
        if (!cancelled) setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (rafId !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [content, disableMath, loadFailed, resolveRenderableImageRef, theme]);

  if (loadFailed) {
    return (
      <div
        className={`h-full overflow-auto rounded p-4 ${
          theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"
        } ${className}`}
      >
        <pre className="whitespace-pre-wrap break-words text-sm">{content}</pre>
      </div>
    );
  }

  return (
    <div
      className={`vditor-preview-pane ${
        theme === "dark" ? "vditor-preview-dark" : "vditor-preview-light"
      } h-full overflow-auto p-4 ${
        theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"
      } ${className}`}
    >
      <div ref={rootRef} />
    </div>
  );
};

export default VditorPreview;
