"use client";

import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  setPage,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return pages.filter((p) => {
      if (totalPages <= 10) return true;
      if (p === 1 || p === totalPages) return true;
      if (Math.abs(p - page) <= 2) return true;
      return false;
    });
  };

  const pages = getPageNumbers();

  return (
    <div className="flex justify-center items-center gap-2 mt-6">
      {/* 이전 버튼 */}
      <button
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-1 border rounded disabled:opacity-40 font-kr"
      >
        이전
      </button>

      {/* 페이지 번호 */}
      {pages.map((p, idx) => {
        const prev = idx > 0 ? pages[idx - 1] : null;
        const needDots = prev && p - prev > 1;

        return (
          <React.Fragment key={p}>
            {needDots && <span className="px-2">…</span>}

            <button
              onClick={() => setPage(p)}
              className={`px-3 py-1 border rounded font-kr ${
                p === page
                  ? "bg-indigo-50 text-indigo-700 border-indigo-500 shadow-sm ring-1 ring-indigo-200 font-semibold"
                  : "bg-white border-gray-300 hover:bg-indigo-50"
              }`}
            >
              {p}
            </button>
          </React.Fragment>
        );
      })}

      {/* 다음 버튼 */}
      <button
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-3 py-1 border rounded disabled:opacity-40 font-kr"
      >
        다음
      </button>
    </div>
  );
}
