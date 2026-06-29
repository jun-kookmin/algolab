"use client";

import React from "react";
import SubmitManage from "@/components/submitManage/SubmitManage";
import FilterExamHwTab from "@/app/class/[classid]/components/FilterExamHwTab";

type SubmitCategory = "HOMEWORK" | "EXAM";
type ExamView = "problem" | "exam";

interface SubmitInfoTabProps {
  data: any;
  lectureName?: string;
  submitTab: SubmitCategory;
  examView: ExamView;
  onSubmitTabChange: (next: SubmitCategory) => void;
  onExamViewChange: (next: ExamView) => void;
}

export default function SubmitInfoTab({
  data,
  lectureName,
  submitTab,
  examView,
  onSubmitTabChange,
  onExamViewChange,
}: SubmitInfoTabProps) {
  const studentsInfo = { data };
  const tab = submitTab;
  const setTab: React.Dispatch<React.SetStateAction<SubmitCategory>> = (
    next
  ) => {
    const resolved = typeof next === "function" ? next(submitTab) : next;
    onSubmitTabChange(resolved);
  };

  const examViewBtnClass =
    "font-kr inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors";

  return (
    <section className="font-kr">
      <p className="mb-6 text-gray-700">
        학생들의 제출정보를 열람할 수 있습니다.
      </p>
      <div className="mb-2">
        <FilterExamHwTab tab={tab} setTab={setTab} />
      </div>
      {tab === "EXAM" && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-sm">
          <button
            type="button"
            onClick={() => onExamViewChange("problem")}
            className={`${examViewBtnClass} ${
              examView === "problem"
                ? "border-indigo-500 bg-white text-indigo-700 shadow-[0_0_0_2px_rgba(99,102,241,0.12)]"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            문제별
          </button>
          <button
            type="button"
            onClick={() => onExamViewChange("exam")}
            className={`${examViewBtnClass} ${
              examView === "exam"
                ? "border-indigo-500 bg-white text-indigo-700 shadow-[0_0_0_2px_rgba(99,102,241,0.12)]"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            시험별
          </button>
        </div>
      )}

      {/* 기존 제출정보 테이블 등 */}
      <SubmitManage
        studentsInfo={studentsInfo}
        tab={tab}
        lectureName={lectureName}
        examView={examView}
      />
    </section>
  );
}
