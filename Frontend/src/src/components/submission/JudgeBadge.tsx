// ──── FILE: src/components/JudgeBadge.tsx ────
"use client";

import React from "react";
import { Judge } from "@/types/submission";

const badgeColor: Record<Judge, string> = {
  정답: "bg-blue-100 text-blue-600",
  오답: "bg-red-100 text-red-600",
  미제출: "bg-gray-100 text-gray-600",
  "컴파일 오류": "bg-yellow-100 text-yellow-700",
  "런타임 오류": "bg-orange-100 text-orange-700",
  에러: "bg-slate-100 text-slate-600",
  "시간 초과": "bg-purple-100 text-purple-700",
  "메모리 초과": "bg-fuchsia-100 text-fuchsia-700",
};

interface JudgeBadgeProps {
  result: Judge;
}

const JudgeBadge: React.FC<JudgeBadgeProps> = ({ result }) => (
  <span
    className={`${
      result === "미제출" ? "pl-[2px]" : "px-2"
    } py-1 rounded text-xs font-semibold ${badgeColor[result] ?? "bg-gray-100 text-gray-600"}`}
  >
    {result}
  </span>
);

export default JudgeBadge;
