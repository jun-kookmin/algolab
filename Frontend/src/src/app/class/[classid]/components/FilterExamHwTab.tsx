import React from "react";
import clsx from "clsx";

type SubmitCategory = "HOMEWORK" | "EXAM";

interface FilterExamHwTabProps {
  tab: SubmitCategory;
  setTab: React.Dispatch<React.SetStateAction<SubmitCategory>>;
}
const FilterExamHwTab = ({ tab, setTab }: FilterExamHwTabProps) => {
  const tabButtonBaseClass =
    "font-kr inline-flex h-9 min-w-[68px] items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors";

  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-1">
      <button
        className={clsx(
          tabButtonBaseClass,
          tab === "EXAM"
            ? "border-indigo-500 bg-white text-indigo-700 shadow-[0_0_0_2px_rgba(99,102,241,0.12)]"
            : "border-transparent bg-transparent text-gray-500 hover:text-gray-700"
        )}
        onClick={() => setTab("EXAM")}
      >
        시험
      </button>
      <button
        className={clsx(
          tabButtonBaseClass,
          tab === "HOMEWORK"
            ? "border-indigo-500 bg-white text-indigo-700 shadow-[0_0_0_2px_rgba(99,102,241,0.12)]"
            : "border-transparent bg-transparent text-gray-500 hover:text-gray-700"
        )}
        onClick={() => setTab("HOMEWORK")}
      >
        과제
      </button>
    </div>
  );
};

export default FilterExamHwTab;
