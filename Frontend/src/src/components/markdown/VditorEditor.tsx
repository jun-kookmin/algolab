"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ensureKatex, loadVditor, type VditorInstance } from "@/utils/vditorLoader";

export interface VditorEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
}

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("이미지 파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });

const VditorEditor: React.FC<VditorEditorProps> = ({
  value,
  onChange,
  placeholder = "문제 설명을 마크다운으로 작성해 주세요",
  height = 520,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const initialValueRef = useRef(value);
  const [loadFailed, setLoadFailed] = useState(false);
  const editorRef = useRef<VditorInstance | null>(null);

  const uploadHandler = useMemo(() => {
    return (files: File[]) => {
      files.forEach(async (file) => {
        if (!file.type.startsWith("image/")) return;
        const dataUrl = await toDataUrl(file);
        editorRef.current?.insertValue(`![${file.name}](${dataUrl})\n`);
      });

      return JSON.stringify({
        msg: "",
        code: 0,
        data: { errFiles: [], succMap: {} },
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const katexReady = await ensureKatex();
        const Vditor = await loadVditor();
        if (cancelled || !rootRef.current) return;

        const editor = new Vditor(rootRef.current, {
          mode: "sv",
          height,
          value: initialValueRef.current,
          placeholder,
          cache: { enable: false },
          preview: {
            hljs: { enable: true, lineNumber: false },
            ...(katexReady ? { math: { engine: "KaTeX", inlineDigit: true } } : {}),
          },
          upload: {
            accept: "image/*",
            multiple: true,
            filename: (name: string) => name,
            handler: uploadHandler,
          },
          input: (md: string) => {
            onChange(md);
          },
        });

        editorRef.current = editor;
      } catch {
        // console.error("[Vditor] initialize failed:", err);
        setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [height, onChange, placeholder, uploadHandler]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = editor.getValue();
    if (current !== value) {
      editor.setValue(value ?? "");
    }
  }, [value]);

  if (loadFailed) {
    return (
      <textarea
        rows={15}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none p-3 text-sm focus:outline-none"
      />
    );
  }

  return <div className="w-full" ref={rootRef} />;
};

export default VditorEditor;
