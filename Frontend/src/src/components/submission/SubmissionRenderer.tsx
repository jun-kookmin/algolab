// ──── FILE: src/components/SubmissionRenderer.tsx ────
"use client";

import React from "react";
import { Submission } from "@/types/submission";
import JudgeBadge from "@/components/submission/JudgeBadge";
import { mapLanguages } from "@/types/languages";

interface Props {
  submissions: Submission[];
  onRowClick?: (s: Submission) => void;
}

type LangKey = "python" | "c" | "cpp" | "java";
const ALIAS_TO_LANG: Record<string, LangKey> = {
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  java: "java",
  python: "python",
  py: "python",
  python3: "python",
};
const LANG_LABEL: Record<LangKey, string> = {
  c: "C",
  cpp: "C++",
  java: "Java",
  python: "Python",
};

function normalizeOne(v: unknown): LangKey | undefined {
  if (typeof v === "number") return mapLanguages([v])[0];
  if (typeof v === "string") {
    const s = v.toLowerCase();
    const asNum = Number(s);
    if (!Number.isNaN(asNum)) return mapLanguages([asNum])[0];
    return ALIAS_TO_LANG[s];
  }
  return undefined;
}

function displayLang(val: unknown): string {
  if (Array.isArray(val)) {
    const labels = val
      .map(normalizeOne)
      .filter((x): x is LangKey => !!x)
      .map((k) => LANG_LABEL[k]);
    return labels.length ? labels.join(", ") : "-";
  }
  const k = normalizeOne(val);
  return k ? LANG_LABEL[k] : "-";
}

const SubmissionRenderer: React.FC<Props> = ({ submissions, onRowClick }) => {
  const clickable = typeof onRowClick === "function";
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full w-full border-collapse text-sm font-kr text-gray-700">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-100 text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
              <th className="px-4 py-2.5 text-left">문제</th>
              <th className="border-l border-gray-300 px-4 py-2.5 text-left">채점결과</th>
              <th className="border-l border-gray-300 px-4 py-2.5 text-center">점수</th>
              <th className="border-l border-gray-300 px-4 py-2.5 text-center">사용 언어</th>
              <th className="border-l border-gray-300 px-4 py-2.5 text-center">
                실행시간
                <br />
                (ms)
              </th>
              <th className="border-l border-gray-300 px-4 py-2.5 text-center">
                메모리
                <br />
                (KB)
              </th>
              <th className="border-l border-gray-300 px-4 py-2.5 text-center">
                길이
                <br />
                (Byte)
              </th>
              <th className="border-l border-gray-300 px-4 py-2.5 text-left">제출일</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s, idx) => {
              return (
                <tr
                  key={idx}
                  className={`${clickable ? "cursor-pointer" : "cursor-default"} border-b border-gray-300 transition-colors ${
                    idx % 2 === 1 ? "bg-slate-100" : "bg-white"
                  } hover:bg-indigo-50`}
                  onClick={clickable ? () => onRowClick?.(s) : undefined}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">{s.problem}</td>
                  <td className="border-l border-gray-300 px-4 py-2.5">
                    <JudgeBadge result={s.judge} />
                  </td>
                  <td className="border-l border-gray-300 px-4 py-2.5 text-center">{s.score}</td>
                  <td className="border-l border-gray-300 px-4 py-2.5 text-center">
                    {displayLang(s.language)}
                  </td>
                  <td className="border-l border-gray-300 px-4 py-2.5 text-center">{s.execTime}</td>
                  <td className="border-l border-gray-300 px-4 py-2.5 text-center">{s.memory}</td>
                  <td className="border-l border-gray-300 px-4 py-2.5 text-center">{s.codeSize}</td>
                  <td className="border-l border-gray-300 px-4 py-2.5 whitespace-nowrap">{s.submittedAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubmissionRenderer;
