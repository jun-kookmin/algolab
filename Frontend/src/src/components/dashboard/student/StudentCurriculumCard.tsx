"use client";

import FilterExamHwTab from "@/app/class/[classid]/components/FilterExamHwTab";
import React, { useState } from "react";

type SubmitCategory = "HOMEWORK" | "EXAM";

interface Props {
  title: string;
  partCnt: number;
  problemCnt: number;
  term: string;
  /** 커리큘럼 보기 버튼 콜백 */
  onView?: (tab?: SubmitCategory) => void;
  type: string | null;
  curriculumLocked?: boolean;
}

/**
 * 학생용 커리큘럼 카드
 */
export default function StudentCurriculumCard({
  title,
  partCnt,
  problemCnt,
  term,
  onView,
  type,
  curriculumLocked = false,
}: Props) {
  const [tab, setTab] = useState<SubmitCategory>("EXAM");
  const isHistoryCard = type === "history";
  const actionButtonBase =
    "font-kr fluid-control-h min-w-0 whitespace-nowrap rounded-[10px] border bg-white px-[clamp(8px,0.7vw,12px)] text-[clamp(11px,0.72vw,13px)] font-medium leading-tight text-center transition-colors active:scale-95";

  return (
    <div className="relative fluid-card-w shrink-0 rounded-[clamp(8px,0.6vw,12px)] bg-white px-[clamp(16px,1.7vw,32px)] pt-[clamp(16px,1.7vw,32px)] ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_14px_rgba(15,23,42,0.04)] h-full">
      {isHistoryCard && (
        <div className="absolute right-4 top-4 z-10">
          <FilterExamHwTab tab={tab} setTab={setTab} />
        </div>
      )}

      <div className="flex h-full flex-col pb-[clamp(12px,1.4vh,16px)]">
        <div className="flex-1">
          <h3
            className={`font-kr fluid-title-md font-semibold mb-2 min-h-[2.6em] leading-tight break-words ${
              isHistoryCard ? "pr-36" : ""
            }`}
          >
            {title}
          </h3>

          <p className="text-sm text-gray-600 mb-1">
            {partCnt} 파트&nbsp;&nbsp;|&nbsp;&nbsp;{problemCnt} 문제
          </p>
          <p className="text-sm text-gray-600">{term}</p>
        </div>

        <div className="mt-6 flex justify-end gap-[clamp(8px,0.7vw,12px)]">
          <button
            onClick={() => {
              if (isHistoryCard) {
                onView?.(tab);
                return;
              }
              if (curriculumLocked) {
                onView?.("EXAM");
                return;
              }
              onView?.("HOMEWORK");
            }}
            className={`${actionButtonBase} fluid-btn-w-md border-indigo-300 text-indigo-600 hover:bg-indigo-50`}
          >
            {isHistoryCard ? "제출기록 보기" : "커리큘럼 보기"}
          </button>
        </div>
      </div>
    </div>
  );
}
