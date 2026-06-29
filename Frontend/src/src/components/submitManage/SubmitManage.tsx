// src/app/(instructor)/SubmitManage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import SubmitStatus from "@/components/submitManage/SubmitStatus";
import type { SubmitInfo, Answer } from "@/types/submit";
import * as XLSX from "xlsx";
import Pagination from "@/components/dashboard/instructor/Pagination";
import Link from "next/link";
import { formatDisplayName } from "@/utils/name";
import { useGetHomeworkSubmissions } from "@/hooks/problems/get/homework/useGetHomeworkSubmissions";
import { useGetExamSubmissions } from "@/hooks/problems/get/exam/useGetExamSubmissions";
import { useGetExams } from "@/hooks/lectures/Get/useGetExams";
import SubmissionProblemModalContent from "@/components/submission/SubmissionProblemModalContent";
import Modal from "@/components/common/modal";

interface SubmitManageProps {
  // 현재 코드에서는 props.studentsInfo.data를 쓰고 있으므로 다음과 같이 정의
  studentsInfo: any;
  tab?: any; // 필요 시 구체 타입으로 교체
  lectureName?: string;
  examView?: "problem" | "exam";
}

export default function SubmitManage({
  studentsInfo,
  tab,
  lectureName,
  examView = "problem",
}: SubmitManageProps) {
  const csvDownloadBtnClass =
    "font-kr inline-flex h-9 items-center justify-center rounded-[10px] border border-blue-300 bg-white px-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 active:scale-95";

  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<null | {
    lectureId: string;
    userId: number;
    problemId: string;
    problemLabel: number;
    tab: "exam" | "homework";
    userName: string;
    studentId: string;
  }>(null);

  const params = useParams();
  const lectureId = String(params.classid ?? "");
  const lectureReady = !!lectureId;

  const isHomework = tab === "HOMEWORK";
  const isExamSummary = !isHomework && examView === "exam";

  // 탭에 따라 하나만 실행되도록 enabled 사용 (Hook 규칙 위반 방지)
  const {
    data: homeworkRes,
    isLoading: isHwLoading,
    isError: isHwError,
  } = useGetHomeworkSubmissions(
    lectureId,
    isHomework && lectureReady
  );

  const {
    data: examRes,
    isLoading: isExLoading,
    isError: isExError,
  } = useGetExamSubmissions(
    lectureId,
    undefined,
    !isHomework && lectureReady,
    isExamSummary ? { lite: true } : undefined
  );

  const { data: exams } = useGetExams(!isHomework ? lectureId : undefined);

  const isLoading = isHomework
    ? isHwLoading
    : isExamSummary
    ? isExLoading
    : isExLoading;
  const isError = isHomework
    ? isHwError
    : isExamSummary
    ? isExError
    : isExError;

  // userId -> 이름 매핑 (props 구조 유지)
  const nameByUid = useMemo(() => {
    const arr = studentsInfo?.data ?? [];
    const m = new Map<number, string>();
    for (const s of arr) {
      if (s.user_id) {
        const rawName = s.full_name ?? s.name ?? "";
        m.set(s.user_id, formatDisplayName(rawName));
      }
    }
    return m;
  }, [studentsInfo]);

  const openModal = (
    userId: number,
    problemId: string,
    problemLabel: number,
    userName: string,
    studentId: string
  ) => {
    setCtx({
      lectureId,
      userId,
      problemId,
      problemLabel,
      tab: isHomework ? "homework" : "exam",
      userName,
      studentId,
    });
    setOpen(true);
  };

  const raw = useMemo(() => {
    if (!isHomework && isExamSummary) return [];
    const data = isHomework ? homeworkRes?.data : examRes?.data;
    return Array.isArray(data) ? data : [];
  }, [isHomework, isExamSummary, homeworkRes, examRes]);

  const catalogProblems = useMemo(() => {
    const catalog = (isHomework
      ? homeworkRes?.problem_catalog
      : examRes?.problem_catalog) ?? [];
    if (Array.isArray(catalog) && catalog.length > 0) {
      return catalog
        .map((problem) => ({
          id: String((problem as any)?.section_problem_uuid ?? ""),
          title: String((problem as any)?.title ?? ""),
        }))
        .filter((problem) => !!problem.id);
    }

    const list: { id: string; title: string }[] = [];
    for (const row of raw) {
      for (const p of row?.problems ?? []) {
        const id = String(
          p?.section_problem_uuid ??
            p?.problem_uuid ??
            p?.uuid ??
            ""
        );
        if (!id) continue;
        list.push({
          id,
          title: String(
            (p as { title?: string; problem_name?: string }).title ??
              (p as { title?: string; problem_name?: string }).problem_name ??
              ""
          ),
        });
      }
    }
    return list;
  }, [examRes?.problem_catalog, homeworkRes?.problem_catalog, isHomework, raw]);

  const problemMeta = useMemo(() => {
    const map = new Map<string, { label: number; title: string }>();
    let idx = 1;
    const add = (key: string, title?: string) => {
      if (!key || map.has(key)) return;
      const normalizedTitle = String(title ?? "").trim();
      map.set(key, { label: idx, title: normalizedTitle || `문제 ${idx}` });
      idx += 1;
    };

    for (const prob of catalogProblems) {
      add(String(prob?.id ?? ""), prob?.title);
    }

    for (const row of raw) {
      for (const prob of row?.problems ?? []) {
        const key = String(
          prob?.section_problem_uuid ??
            prob?.problem_uuid ??
            prob?.uuid ??
            ""
        );
        add(
          key,
          ((prob as { title?: string; problem_name?: string }).title ??
            (prob as { title?: string; problem_name?: string }).problem_name ??
            "")
        );
      }
    }
    return map;
  }, [catalogProblems, raw]);

  const problemColumns = useMemo(
    () =>
      Array.from(problemMeta.entries())
        .map(([id, meta]) => ({ id, label: meta.label, title: meta.title }))
        .sort((a, b) => a.label - b.label),
    [problemMeta]
  );

  type ExamSummaryRow = {
    id: number;
    rowKey: string;
    name: string;
    studentId: string;
    byExam: Record<string, { solved: number; total: number }>;
  };

  const examSummaryRows: ExamSummaryRow[] = useMemo(() => {
    if (!isExamSummary) return [];
    const members = Array.isArray(studentsInfo?.data) ? studentsInfo.data : [];
    if (!members.length) return [];
    const examSummaryData = Array.isArray(examRes?.data) ? examRes.data : [];
    const problemCatalog = Array.isArray(examRes?.problem_catalog)
      ? examRes.problem_catalog
      : [];

    const totalsByExam = new Map<string, number>();
    for (const exam of exams ?? []) {
      totalsByExam.set(String(exam.id), 0);
    }

    const problemToExamId = new Map<string, string>();
    for (const row of problemCatalog) {
      const sectionProblemUuid = String((row as any)?.section_problem_uuid ?? "");
      const examId = String((row as any)?.exam_id ?? "");
      if (!sectionProblemUuid || !examId) continue;
      problemToExamId.set(sectionProblemUuid, examId);
      totalsByExam.set(examId, (totalsByExam.get(examId) ?? 0) + 1);
    }

    for (const exam of exams ?? []) {
      const examId = String(exam.id);
      if ((totalsByExam.get(examId) ?? 0) === 0) {
        totalsByExam.set(examId, Number((exam as any)?.problem_count ?? 0) || 0);
      }
    }

    const isSolvedStatus = (status: unknown) => {
      const normalized = String(status ?? "").toUpperCase();
      return (
        normalized === "CORRECT" ||
        normalized === "AC" ||
        normalized === "SV" ||
        normalized === "SUCCESS" ||
        normalized === "SOLVED"
      );
    };

    const solvedByExamAndUser = new Map<number, Map<string, number>>();
    for (const row of examSummaryData) {
      const userId = typeof row?.user_id === "number" ? row.user_id : null;
      if (userId == null) continue;
      const counts = new Map<string, number>();
      const problems = Array.isArray(row?.problems) ? row.problems : [];
      for (const problem of problems) {
        const sectionProblemUuid = String(problem?.section_problem_uuid ?? "");
        const examId = problemToExamId.get(sectionProblemUuid);
        if (!examId || !isSolvedStatus(problem?.status)) continue;
        counts.set(examId, (counts.get(examId) ?? 0) + 1);
      }
      solvedByExamAndUser.set(userId, counts);
    }

    const rows = members.map((m: any, idx: number) => {
      const parsedUserId = Number(m.user_id);
      const userId = Number.isFinite(parsedUserId) ? parsedUserId : 0;
      const rowKey = [
        m.uuid,
        m.user_id,
        m.student_code,
        m.studentId,
        m.full_name,
        m.name,
        idx,
      ]
        .map((v) => String(v ?? "").trim())
        .join("|");
      const name =
        nameByUid.get(userId) ?? formatDisplayName(m.full_name ?? m.name ?? "");
      const studentId = String(m.student_code ?? m.studentId ?? "");
      const byExam: Record<string, { solved: number; total: number }> = {};
      const solvedCounts = solvedByExamAndUser.get(userId) ?? new Map<string, number>();
      for (const ex of exams ?? []) {
        const exId = String(ex.id);
        const total = totalsByExam.get(exId) ?? 0;
        const solved = solvedCounts.get(exId) ?? 0;
        byExam[exId] = { solved: total ? Math.min(solved, total) : solved, total };
      }
      return { id: userId, rowKey, name, studentId, byExam };
    });

    rows.sort((a: { studentId: string }, b: { studentId: string }) => {
      const aId = (a.studentId ?? "").toString().trim();
      const bId = (b.studentId ?? "").toString().trim();
      if (aId && bId) {
        return aId.localeCompare(bId, "ko", {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (aId) return -1;
      if (bId) return 1;
      return 0;
    });
    return rows;
  }, [
    isExamSummary,
    studentsInfo,
    exams,
    examRes?.data,
    examRes?.problem_catalog,
    nameByUid,
  ]);

  // 테이블/엑셀 공용 데이터로 정규화
  const submitList: SubmitInfo[] = useMemo(() => {
    if (!raw.length) return [];
    const normalized = raw.map((p: any) => {
      const latestOnTime = new Map<string, any>();
      const latestOnTimeCorrect = new Map<string, any>();
      const latestAny = new Map<string, any>();
      const firstCorrectAttemptByProblem = new Map<string, number>();
      for (const prob of p.problems ?? []) {
        const key = String(
          prob?.section_problem_uuid ??
            prob?.problem_uuid ??
            prob?.uuid ??
            prob?.problem_id ??
            ""
        );
        if (!key) continue;
        const rawStatus = String(prob?.status ?? "").toUpperCase();
        const isCorrect =
          rawStatus === "CORRECT" || rawStatus === "AC" || rawStatus === "SV";
        const firstCorrectAttempt = Number(prob?.first_correct_attempt_count ?? 0);
        if (isHomework && firstCorrectAttempt > 0) {
          const prevAttempt = firstCorrectAttemptByProblem.get(key);
          if (prevAttempt == null || firstCorrectAttempt < prevAttempt) {
            firstCorrectAttemptByProblem.set(key, firstCorrectAttempt);
          }
        }
        const updateLatest = (map: Map<string, any>, item: any) => {
          const prev = map.get(key);
          if (!prev) {
            map.set(key, item);
            return;
          }
          const prevTs = Date.parse(prev?.submission_time ?? "");
          const curTs = Date.parse(item?.submission_time ?? "");
          if ((Number.isFinite(curTs) ? curTs : 0) >= (Number.isFinite(prevTs) ? prevTs : 0)) {
            map.set(key, item);
          }
        };
        updateLatest(latestAny, prob);
        if (!prob?.is_late) {
          updateLatest(latestOnTime, prob);
          if (isCorrect) {
            updateLatest(latestOnTimeCorrect, prob);
          }
        }
      }

      const latestByProblem = new Map<string, any>();
      for (const [key, latest] of latestAny.entries()) {
        latestByProblem.set(
          key,
          latestOnTimeCorrect.get(key) ?? latestOnTime.get(key) ?? latest
        );
      }

      // 문제별 최신 제출만 Answer로 변환
      const answers: Answer[] = Array.from(latestByProblem.values())
        .map((prob: any) => {
          const key = String(
            prob?.section_problem_uuid ??
              prob?.problem_uuid ??
              prob?.uuid ??
              prob?.problem_id ??
              ""
          );
          if (!key) return null;
          const questionNumber = problemMeta.get(key)?.label ?? 0;
          const rawStatus = String(prob?.status ?? "").toUpperCase();
          const isLate = !!prob?.is_late;
          const status: Answer["status"] =
            isLate
              ? "지각"
              : rawStatus === "CORRECT" || rawStatus === "AC" || rawStatus === "SV"
              ? "정답"
              : rawStatus === "NOT_SUBMITTED" || rawStatus === ""
              ? "미채점"
              : "오답";
          return {
            questionId: key,
            questionNumber,
            status,
            attempts:
              prob.attempt_count ??
              prob.ju_count ??
              prob.submission_count ??
              0,
            firstCorrectAttempts: isHomework
              ? firstCorrectAttemptByProblem.get(key)
              : undefined,
            score: isLate ? 0 : prob.score ?? 0,
          };
        })
        .filter(Boolean) as Answer[];

      const acceptedCount = answers.filter((a) => a.status === "정답").length;
      const totalProblems =
        Number(
          isHomework
            ? p?.total_count
            : p?.total_problem_count ?? p?.total_count
        ) || problemMeta.size || answers.length;

      return {
        id: p.user_id,
        name: nameByUid.get(p.user_id) ?? "",
        studentId: p.student_number,
        score: Math.min(acceptedCount, totalProblems),
        total: totalProblems,
        answers,
      };
    });
    normalized.sort((a, b) => {
      const aId = (a.studentId ?? "").toString().trim();
      const bId = (b.studentId ?? "").toString().trim();
      if (aId && bId) {
        return aId.localeCompare(bId, "ko", { numeric: true, sensitivity: "base" });
      }
      if (aId) return -1;
      if (bId) return 1;
      return 0;
    });
    return normalized;
  }, [raw, nameByUid, problemMeta, isHomework]);

  const maxProblems = useMemo(
    () => problemColumns.length,
    [problemColumns.length]
  );

  const examColumns = useMemo(
    () =>
      (exams ?? []).map((ex) => ({
        id: String(ex.id),
        title: String(ex.exam_name ?? ex.title ?? "시험"),
      })),
    [exams]
  );

  const [page, setPage] = useState(1);
  const viewSize = 20;
  const totalItems = isExamSummary ? examSummaryRows.length : submitList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / viewSize));
  const startIndex = (page - 1) * viewSize;
  const endIndex = startIndex + viewSize;

  useEffect(() => {
    setPage(1);
  }, [
    lectureId,
    viewSize,
    isHomework,
    examView,
    submitList.length,
    examSummaryRows.length,
  ]);

  const pageList = useMemo(
    () =>
      (isExamSummary ? examSummaryRows : submitList).slice(
        startIndex,
        Math.min(endIndex, totalItems)
      ),
    [isExamSummary, examSummaryRows, submitList, startIndex, endIndex, totalItems]
  );

  const sanitizeFilename = (value: string) =>
    value
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim();

  const protectForExcel = (v: string | number) => {
    const s = String(v);
    if (/[\/]/.test(s)) return `="${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleDownloadCSV = () => {
    const headers: string[] = ["이름", "학번", "점수"];
    for (let i = 1; i <= maxProblems; i++) {
      const meta = problemColumns.find((p) => p.label === i);
      const title = meta?.title ?? `${i}번`;
      headers.push(
        title,
        `${title} 첫 정답시 제출횟수`,
        `${title} 제출횟수`
      );
    }

    const rows = submitList.map((s) => {
      const base = [
        s.name,
        s.studentId ?? "",
        protectForExcel(`${s.score}/${s.total}`),
      ];
      const cells: (string | number)[] = [];
      for (let i = 1; i <= maxProblems; i++) {
        const a = s.answers.find((x) => x.questionNumber === i);
        cells.push(
          a?.score ?? 0,
          a?.firstCorrectAttempts ?? "",
          a?.attempts ?? 0
        );
      }
      return [...base, ...cells];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ",", RS: "\r\n" });

    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const safeLectureName = sanitizeFilename(lectureName || "");
    const lectureLabel = safeLectureName || lectureId;
    const filename = `성적표_${lectureLabel}_${y}${m}${day}.csv`;

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExamSummaryCSV = () => {
    if (!examColumns.length) return;
    const headers = ["이름", "학번", ...examColumns.map((ex) => ex.title)];
    const rows = examSummaryRows.map((row) => {
      const base = [row.name, row.studentId ?? ""];
      const cells = examColumns.map((ex) => {
        const cell = row.byExam[ex.id] ?? { solved: 0, total: 0 };
        return protectForExcel(`${cell.solved}/${cell.total}`);
      });
      return [...base, ...cells];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ",", RS: "\r\n" });

    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const safeLectureName = sanitizeFilename(lectureName || "");
    const lectureLabel = safeLectureName || lectureId;
    const filename = `시험별성적표_${lectureLabel}_${y}${m}${day}.csv`;

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const problemIds = useMemo(() => problemColumns, [problemColumns]);

  if (isLoading) return <p>불러오는 중...</p>;
  if (isError) return <p>데이터를 불러올 수 없습니다.</p>;

  // console.log(homeworkRes, "과제 제출");
  // console.log(examRes, "시험제출");

  if (isExamSummary) {
    if (!examColumns.length) {
      return <p className="text-sm text-gray-500">표시할 시험이 없습니다.</p>;
    }

    return (
      <div className="relative w-full font-kr mb-[20px]">
        <div className="mb-3 flex justify-end items-center">
          <button
            type="button"
            onClick={handleDownloadExamSummaryCSV}
            className={csvDownloadBtnClass}
          >
            CSV 다운로드
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm">
          <div className="max-h-[63vh] overflow-x-auto overflow-y-auto">
            <table className="min-w-max border-separate border-spacing-0 text-sm text-gray-700">
              <thead className="sticky top-0 z-30 bg-gray-100">
                <tr className="border-b border-gray-300 text-center text-gray-600">
                  <th className="sticky top-0 left-0 z-20 w-28 border-b border-gray-300 bg-gray-100 px-4 py-2.5 text-left font-kr text-sm font-semibold">
                  이름
                  </th>
                  <th className="sticky top-0 left-[112px] z-20 w-32 border-b border-gray-300 bg-gray-100 px-4 py-2.5 text-left font-kr text-sm font-semibold">
                  학번
                  </th>
                  {examColumns.map((ex) => (
                    <th
                      key={`ex-${ex.id}`}
                      className="sticky top-0 z-10 border-b border-gray-300 bg-gray-100 px-2 py-2.5 text-center font-kr text-sm font-semibold"
                      title={ex.title}
                    >
                      <span className="inline-block max-w-[160px] truncate">
                        {ex.title}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pageList as ExamSummaryRow[]).map((row, idx) => {
                  const rowBg = idx % 2 === 1 ? "bg-slate-100" : "bg-white";
                  return (
                    <tr
                      key={`summary-${row.rowKey}`}
                      className={`${rowBg} border-b border-gray-300`}
                    >
                      <td
                        className={`sticky left-0 z-10 w-28 truncate px-4 py-2.5 text-left font-kr text-sm font-medium ${rowBg}`}
                      >
                        {row.name}
                      </td>
                      <td
                        className={`sticky left-[112px] z-10 w-32 truncate px-4 py-2.5 text-left font-kr text-sm font-medium ${rowBg}`}
                      >
                        {row.studentId}
                      </td>
                      {examColumns.map((ex) => {
                        const cell = row.byExam[ex.id] ?? { solved: 0, total: 0 };
                        const solved = Number(cell.solved ?? 0);
                        const total = Number(cell.total ?? 0);
                        return (
                          <td
                            key={`summary-${row.rowKey}-${ex.id}`}
                            className="px-2 py-2.5 text-center font-kr text-sm"
                          >
                            {solved}/{total}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          page={page}
          total={totalPages}
          onChange={setPage}
          className="mt-3 mb-[20px]"
        />
        <div className="h-[10px]" />
      </div>
    );
  }

  return (
    <div className="relative w-full font-kr mb-[20px]">
      <div className="mb-3 flex justify-between items-center">
        <div className="my-1 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#49DE26]" />
            정답
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#FF5E5E]" />
            오답
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#D9D9D9]" />
            미제출
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadCSV}
          className={csvDownloadBtnClass}
        >
          CSV 다운로드
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm">
        <div className="max-h-[63vh] overflow-x-auto overflow-y-auto">
          <table className="min-w-max border-separate border-spacing-0 text-sm text-gray-700">
            <thead className="sticky top-0 z-30 bg-gray-100">
              <tr className="border-b border-gray-300 text-center text-gray-600">
                <th className="sticky top-0 left-0 z-20 w-24 border-b border-gray-300 bg-gray-100 px-4 py-2.5 text-left font-kr text-sm font-semibold">
                점수
                </th>
                <th className="sticky top-0 left-24 z-20 w-24 border-b border-gray-300 bg-gray-100 px-4 py-2.5 text-left font-kr text-sm font-semibold">
                이름
                </th>
                <th className="sticky top-0 left-[192px] z-20 w-28 border-b border-gray-300 bg-gray-100 px-4 py-2.5 text-left font-kr text-sm font-semibold">
                학번
                </th>

                {/* 문제 번호 헤더 */}
                {problemIds.map((pid) => (
                  <th
                    key={`h-${pid.id}`}
                    className="sticky top-0 z-10 border-b border-gray-300 bg-gray-100 px-2 py-2.5 text-center font-kr text-sm font-semibold"
                    title={pid.title}
                  >
                    <span className="inline-block max-w-[140px] truncate">
                      {pid.title}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {(pageList as SubmitInfo[]).map((item, idx) => {
                const rowBg = idx % 2 === 1 ? "bg-slate-100" : "bg-white";
                return (
                  <tr key={item.id} className={`${rowBg} border-b border-gray-300`}>
                    <td
                      className={`sticky left-0 z-10 w-24 px-4 py-2.5 text-left font-kr text-sm font-medium ${rowBg}`}
                    >
                      {item.score}/{item.total}
                    </td>
                    <td
                      className={`sticky left-24 z-10 w-24 truncate px-4 py-2.5 text-left font-kr text-sm font-medium ${rowBg}`}
                    >
                      <Link
                        href={{
                          pathname: `/submission/${item.id}`,
                          query: {
                            lid: lectureId,
                            tab: isHomework ? "homework" : "exam",
                            name: item.name,
                          },
                        }}
                        className="cursor-pointer hover:text-[#4E61F6] hover:underline"
                        prefetch={false}
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td
                      className={`sticky left-[192px] z-10 w-28 px-4 py-2.5 text-left font-kr text-sm font-medium ${rowBg}`}
                    >
                      {item.studentId}
                    </td>

                    {problemIds.map((pid) => {
                      const answer =
                        item.answers.find((a) => a.questionId === pid.id) ??
                        ({
                          questionNumber: pid.label,
                          status: "미채점",
                          attempts: 0,
                          firstCorrectAttempts: undefined,
                          score: 0,
                        } as Answer);

                      return (
                        <td
                          key={`c-${item.id}-${pid.id}`}
                          className="items-center px-2 py-2.5"
                        >
                          <button
                            onClick={() =>
                              openModal(
                                item.id,
                                pid.id,
                                pid.label,
                                item.name,
                                item.studentId
                              )
                            }
                            className="flex justify-center"
                          >
                            <SubmitStatus
                              answers={[answer]}
                              showFirstCorrectAttempts={isHomework}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        total={totalPages}
        onChange={setPage}
        className="mt-3 mb-[20px]"
      />
      <div className="h-[10px]" />
      {open && ctx && (
        <Modal onClose={() => setOpen(false)} title="제출 상세 보기">
          <SubmissionProblemModalContent
            lectureId={ctx.lectureId}
            userId={ctx.userId}
            problemId={ctx.problemId}
            problemLabel={ctx.problemLabel}
            tab={ctx.tab}
            userName={ctx.userName}
            studentId={ctx.studentId}
          />
        </Modal>
      )}
    </div>
  );
}
