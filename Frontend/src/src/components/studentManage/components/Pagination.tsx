"use client";

import React, { useMemo } from "react";
import clsx from "clsx";

type PaginationProps = {
  isStudentManage?: boolean;
  deleteBttnClick?: () => Promise<void>;
  deleteBttndisabled?: boolean;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  maxButtons?: number;
  className?: string;
  showRange?: boolean;
  labels?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
    total?: string;
    unit?: string;
  };
};

export default function Pagination({
  isStudentManage,
  deleteBttnClick,
  deleteBttndisabled,
  page,
  totalItems,
  pageSize,
  onPageChange,
  maxButtons = 5,
  className,
  showRange = true,
  labels = {
    first: "처음",
    prev: "이전",
    next: "다음",
    last: "마지막",
    total: "총",
    unit: "명",
  },
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const pageItems = useMemo<(number | string)[]>(() => {
    const VISIBLE = Math.max(3, maxButtons);
    if (totalPages <= VISIBLE) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const middleCount = VISIBLE - 2;
    let left = Math.max(2, page - Math.floor(middleCount / 2));
    let right = left + middleCount - 1;
    if (right > totalPages - 1) {
      right = totalPages - 1;
      left = Math.max(2, right - middleCount + 1);
    }
    const items: (number | string)[] = [1];
    if (left > 2) items.push("…");
    for (let p = left; p <= right; p++) items.push(p);
    if (right < totalPages - 1) items.push("…");
    items.push(totalPages);
    return items;
  }, [page, totalPages, maxButtons]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const handleFirst = () => page !== 1 && onPageChange(1);
  const handlePrev = () => canPrev && onPageChange(page - 1);
  const handleNext = () => canNext && onPageChange(page + 1);
  const handleLast = () => page !== totalPages && onPageChange(totalPages);

  const rangeStart = totalItems === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(endIndex, totalItems);

  // 모든 버튼에 공통으로 적용: 가로쓰기·줄바꿈금지·고정높이/최소폭
  const btnBase =
    "inline-flex items-center justify-center shrink-0 " +
    "h-9 min-w-[30px] max-h-[30px] text-xs px-2 rounded-lg border transition-colors " +
    "whitespace-nowrap [writing-mode:horizontal-tb]";

  return (
    <div
      className={clsx(
        className,
        "mt-3 flex flex-wrap items-center justify-between gap-2 text-sm font-kr mb-[30px]"
      )}
    >
      {/* 왼쪽 영역: 선택 학생 삭제 */}
      <div className="flex items-center">
        {isStudentManage && (
          <button
            onClick={deleteBttnClick}
            disabled={deleteBttndisabled}
            className={clsx(
              btnBase,
              "border-red-200 bg-red-50 text-red-600 disabled:opacity-50"
            )}
          >
            선택 학생 삭제
          </button>
        )}
      </div>

      {/* 가운데 영역: 페이지 버튼들 -> 가로 스크롤 허용 */}
      <div className="max-w-full ">
        <div className="flex items-center gap-1 whitespace-nowrap">
          {/* 처음 / 이전 */}
          <button
            type="button"
            onClick={handleFirst}
            disabled={page === 1}
            aria-label="처음 페이지"
            className={clsx(
              btnBase,
              "border-gray-400 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            )}
          >
            {labels.first ?? "처음"}
          </button>
          <button
            type="button"
            onClick={handlePrev}
            disabled={!canPrev}
            aria-label="이전 페이지"
            className={clsx(
              btnBase,
              "border-gray-400 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            )}
          >
            {labels.prev ?? "이전"}
          </button>

          {/* 숫자/점 버튼 */}
          {pageItems.map((it, idx) =>
            typeof it === "number" ? (
              <button
                type="button"
                key={`p-${it}-${idx}`}
                onClick={() => onPageChange(it)}
                aria-current={page === it ? "page" : undefined}
                className={clsx(
                  btnBase,
                  page === it
                    ? "bg-indigo-50 text-indigo-700 border-indigo-500 shadow-sm ring-1 ring-indigo-200 font-semibold"
                    : "text-gray-700 border-gray-400 hover:bg-indigo-600 hover:text-white"
                )}
              >
                {it}
              </button>
            ) : (
              <span
                key={`dots-${idx}`}
                className="inline-flex h-9 items-center px-2 text-gray-400 select-none"
              >
                {it}
              </span>
            )
          )}

          {/* 다음 / 마지막 */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext}
            aria-label="다음 페이지"
            className={clsx(
              btnBase,
              "border-gray-400 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            )}
          >
            {labels.next ?? "다음"}
          </button>
          <button
            type="button"
            onClick={handleLast}
            disabled={page === totalPages}
            aria-label="마지막 페이지"
            className={clsx(
              btnBase,
              "border-gray-400 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            )}
          >
            {labels.last ?? "마지막"}
          </button>
        </div>
      </div>

      {/* 오른쪽 영역: 범위/총원 (좁으면 다음 줄로 내려감) */}
      {showRange ? (
        <div className="flex items-center text-gray-500 whitespace-nowrap text-xs">
          {labels.total ?? "총"}{" "}
          <b className="mx-1 text-gray-700">{totalItems}</b>
          {labels.unit ?? "명"} · {rangeStart}-{rangeEnd}
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
