"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import LoadingSpinner from "@/components/studentManage/components/LoadingSpinner";
import Pagination from "@/components/studentManage/components/Pagination";
import {
  LectureStudentActivityRow,
  useGetLectureStudentActivity,
} from "@/hooks/lectures/Get/useGetLectureStudentActivity";

const Search = "/assets/icon/Icon_Search.svg";
const Down = "/assets/icon/Icon_Down.svg";
const Refresh = "/assets/icon/Icon_Refresh.svg";

const toDisplayName = (row: LectureStudentActivityRow) =>
  row.full_name || "-";

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
};

interface StudentActivityTabProps {
  lectureStartDate?: string | null;
  lectureEndDate?: string | null;
}

type TotalSortDirection = "none" | "desc" | "asc";

export default function StudentActivityTab({
  lectureStartDate,
  lectureEndDate,
}: StudentActivityTabProps) {
  const params = useParams();
  const lectureId = String(params.classid ?? "");

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewSize, setViewSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalSortDirection, setTotalSortDirection] =
    useState<TotalSortDirection>("none");
  const defaultsAppliedRef = useRef(false);

  useEffect(() => {
    if (defaultsAppliedRef.current) return;

    const defaultStartDate = toDateInputValue(lectureStartDate);
    const defaultEndDate = toDateInputValue(lectureEndDate);
    if (!defaultStartDate && !defaultEndDate) return;

    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    defaultsAppliedRef.current = true;
  }, [lectureStartDate, lectureEndDate]);

  const isRangeInvalid = Boolean(
    startDate && endDate && startDate > endDate
  );

  const { data, isLoading, isFetching, error, refetch } =
    useGetLectureStudentActivity(
      lectureId,
      { startDate, endDate },
      {
        enabled: !isRangeInvalid,
      }
    );

  const rows = data?.data ?? [];
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      `${row.student_code}${toDisplayName(row)}`
        .toLowerCase()
        .includes(query)
    );
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    if (totalSortDirection === "none") return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const totalDiff = a.total_count - b.total_count;
      if (totalDiff !== 0) {
        return totalSortDirection === "asc" ? totalDiff : -totalDiff;
      }

      return String(a.student_code ?? "").localeCompare(
        String(b.student_code ?? ""),
        "ko",
        { numeric: true, sensitivity: "base" }
      );
    });
  }, [filteredRows, totalSortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / viewSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * viewSize;
    return sortedRows.slice(start, start + viewSize);
  }, [sortedRows, page, viewSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, startDate, endDate, viewSize, totalSortDirection]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const viewSizeOptions = [10, 25, 50, 100];
  const summary = data?.summary ?? {
    post_count: 0,
    reply_count: 0,
    total_count: 0,
  };

  const headerCellClass =
    "whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-gray-600";
  const bodyCellClass =
    "whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-800";
  const numberCellClass =
    "whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-800 tabular-nums";
  const totalSortLabel =
    totalSortDirection === "desc"
      ? "↓"
      : totalSortDirection === "asc"
        ? "↑"
        : "↕";
  const toggleTotalSort = () => {
    setTotalSortDirection((current) => {
      if (current === "none") return "desc";
      if (current === "desc") return "asc";
      return "none";
    });
  };

  return (
    <section className="min-h-[400px] bg-transparent font-kr">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[260px] max-w-full">
            <label htmlFor="activitySearch" className="sr-only">
              이름, 학번
            </label>
            <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-indigo-500">
              <input
                id="activitySearch"
                type="text"
                placeholder="이름, 학번"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Image
                alt="Search icon"
                src={Search}
                width={20}
                height={20}
                className="pointer-events-none shrink-0"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="activityStartDate"
              className="mb-1 block text-xs font-semibold text-gray-500"
            >
              시작일
            </label>
            <input
              id="activityStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="activityEndDate"
              className="mb-1 block text-xs font-semibold text-gray-500"
            >
              종료일
            </label>
            <input
              id="activityEndDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching || isRangeInvalid}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            aria-label="새로고침"
          >
            <Image
              alt=""
              src={Refresh}
              width={18}
              height={18}
              className={isFetching ? "animate-[spin_0.6s_linear_infinite]" : ""}
            />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#6D717F]">
          <span>게시글 {summary.post_count}</span>
          <span>댓글 {summary.reply_count}</span>
          <span>총 {summary.total_count}</span>
        </div>
      </div>

      {isRangeInvalid && (
        <p className="mb-3 text-sm font-medium text-red-600">
          종료일은 시작일 이후로 선택해주세요.
        </p>
      )}

      <div className="mb-4 flex justify-end">
        <div className="relative w-[160px]">
          <label htmlFor="activityViewSize" className="sr-only">
            한 페이지 표시 개수
          </label>
          <select
            id="activityViewSize"
            value={viewSize}
            onChange={(e) => setViewSize(Number(e.target.value))}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-700 hover:bg-gray-50 focus:border-indigo-500 focus:outline-none"
          >
            {viewSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}개씩 보기
              </option>
            ))}
          </select>
          <Image
            alt=""
            src={Down}
            width={14}
            height={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr className="border-b border-gray-300">
                <th className={headerCellClass}>학번</th>
                <th className={headerCellClass}>이름</th>
                <th className={`${headerCellClass} text-right`}>게시글 수</th>
                <th className={`${headerCellClass} text-right`}>댓글 수</th>
                <th
                  className={`${headerCellClass} text-right`}
                  aria-sort={
                    totalSortDirection === "desc"
                      ? "descending"
                      : totalSortDirection === "asc"
                        ? "ascending"
                        : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={toggleTotalSort}
                    className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    aria-label="총 활동 수 정렬"
                  >
                    <span>총 활동 수</span>
                    <span className="text-xs text-gray-500">{totalSortLabel}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                    <span className="inline-flex items-center">
                      <LoadingSpinner className="mr-2 text-indigo-600" size={22} />
                      불러오는 중...
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-red-600">
                    활동 집계를 불러오지 못했습니다.
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                    표시할 학생이 없습니다.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, index) => (
                  <tr
                    key={`${row.user_id ?? "pending"}-${row.student_code}-${index}`}
                    className={`border-b border-gray-200 ${
                      index % 2 === 1 ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    <td className={bodyCellClass}>{row.student_code || "-"}</td>
                    <td className={bodyCellClass}>{toDisplayName(row)}</td>
                    <td className={numberCellClass}>{row.post_count}</td>
                    <td className={numberCellClass}>{row.reply_count}</td>
                    <td className={numberCellClass}>{row.total_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        totalItems={sortedRows.length}
        pageSize={viewSize}
        onPageChange={setPage}
        labels={{ unit: "명" }}
      />
    </section>
  );
}
