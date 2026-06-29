// ──── FILE: src/components/editor/MonacoEditor.tsx ────
"use client";

import React from "react";
import Editor, { OnChange } from "@monaco-editor/react";
import type { Language } from "@/types/languages"; // 내부 키: 'c' | 'cpp' | 'python' | 'java'

type MonacoTheme = "vs" | "vs-dark";

interface MonacoEditorProps {
  language?: Language;                 // ✅ 언어 타입을 중앙 정의와 통일
  initialCode?: string;
  value?: string;
  onCodeChange?: (newValue: string) => void;
  width?: string;
  height?: string;
  theme?: MonacoTheme;
  readonly?: boolean;
  scrollBeyondLastLine?: boolean;
}

// Monaco가 지원하는 실제 language id로 매핑
const monacoLanguageMap: Record<Language, string> = {
  c: "cpp",       // Monaco는 'c' 대신 'cpp' 하이라이트를 쓰는 게 일반적
  cpp: "cpp",
  java: "java",
  python: "python",
};

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  language = "cpp",
  initialCode = "// 여기에 입력하세요",
  onCodeChange,
  width = "100%",
  height = "100%",
  theme = "vs-dark",
  readonly = false,
  scrollBeyondLastLine = true,
  value,
}) => {
  const editorValue = value ?? initialCode;

  const handleEditorChange: OnChange = (value) => {
    if (value !== undefined && onCodeChange) {
      onCodeChange(value);
    }
  };

  return (
    <Editor
      width={width}
      height={height}
      language={monacoLanguageMap[language]}
      value={editorValue}
      defaultValue={undefined}
      onChange={handleEditorChange}
      theme={theme}
      options={{
        fontSize: 14,
        tabSize: 4,
        minimap: { enabled: false },
        bracketPairColorization: { enabled: true },
        overviewRulerBorder: false,
        readOnly: readonly,
        scrollBeyondLastLine,
      }}
      className="bg-transparent border-none outline-none"
    />
  );
};

export default MonacoEditor;
