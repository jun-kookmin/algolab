"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDisplayName } from "@/utils/name";
import BulkUploadModal from "@/components/studentManage/BulkUploadModal";
import StudentManageLeft from "@/components/studentManage/StudentManageLeft";
import StudentManageRight from "@/components/studentManage/StudentManageRight";

import { Student } from "@/types/student";
import { useParams } from "next/navigation";
import AddStudentModal from "@/components/studentManage/AddStudentModal";
import { useAddLectureMembers } from "@/hooks/lectures/Put/useAddLectureMembers";
import { UseQueryResult } from "@tanstack/react-query";
import { LectureMembersResponse } from "@/hooks/lectures/Get/useGetLectureMembers";
import { useRemoveLectureMember } from "@/hooks/lectures/Delete/useRemoveLectureMember";
import SuccessToast from "@/app/class/[classid]/components/SuccesToast";
import ConfirmDeleteModal from "@/app/class/[classid]/components/ConfirmDeleteModal";
import { useGetHomeworkSubmissions } from "@/hooks/problems/get/homework/useGetHomeworkSubmissions";
import { useGetExamSubmissions } from "@/hooks/problems/get/exam/useGetExamSubmissions";
import { useGetExams } from "@/hooks/lectures/Get/useGetExams";
import { useGetLectureStudentActivity } from "@/hooks/lectures/Get/useGetLectureStudentActivity";

// 학번/사번/교번: 기본은 숫자만 6자리 이상, 그 외 특수문자 허용 문자열(4~32자)
const looksLikeStudentId = (v?: string) =>
  !!v && (/^\d{6,}$/.test(v) || /^[A-Za-z0-9._-]{4,32}$/.test(v));
const normalizeStudentId = (v?: string) => v?.toString().trim() || "";

type WorkbookProblemColumn = {
  id: string;
  title: string;
  examId?: string;
};

type GradeRosterRow = {
  userId: number;
  name: string;
  studentId: string;
};

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
};

const sanitizeFilename = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

const isCorrectStatus = (status: unknown) => {
  const normalized = String(status ?? "").toUpperCase();
  return (
    normalized === "CORRECT" ||
    normalized === "AC" ||
    normalized === "SV" ||
    normalized === "SUCCESS" ||
    normalized === "SOLVED"
  );
};

const getProblemKey = (problem: any) =>
  String(
    problem?.section_problem_uuid ??
      problem?.problem_uuid ??
      problem?.uuid ??
      problem?.problem_id ??
      ""
  );

const getProblemTitle = (problem: any, fallback: string) => {
  const title = String(problem?.title ?? problem?.problem_name ?? "").trim();
  return title || fallback;
};

const collectProblemColumns = (
  catalog: unknown,
  rows: any[] = []
): WorkbookProblemColumn[] => {
  const map = new Map<string, WorkbookProblemColumn>();
  const add = (id: string, title: string, examId?: string) => {
    if (!id || map.has(id)) return;
    map.set(id, { id, title, examId });
  };

  if (Array.isArray(catalog)) {
    catalog.forEach((problem, index) => {
      const id = String((problem as any)?.section_problem_uuid ?? "");
      add(
        id,
        getProblemTitle(problem, `문제 ${index + 1}`),
        (problem as any)?.exam_id != null ? String((problem as any).exam_id) : undefined
      );
    });
  }

  rows.forEach((row) => {
    (Array.isArray(row?.problems) ? row.problems : []).forEach(
      (problem: any) => {
        const id = getProblemKey(problem);
        add(id, getProblemTitle(problem, `문제 ${map.size + 1}`));
      }
    );
  });

  return Array.from(map.values());
};

const getProblemScore = (problem: any) => Number(problem?.score ?? 0) || 0;

const getAttemptCount = (problem: any) =>
  Number(
    problem?.attempt_count ??
      problem?.ju_count ??
      problem?.submission_count ??
      0
  ) || 0;

const toWorkbookStatus = (problem: any | undefined, includeLate = false) => {
  if (!problem) return "미제출";
  if (includeLate && problem?.is_late) return "지각";
  const normalized = String(problem?.status ?? "").toUpperCase();
  if (isCorrectStatus(normalized)) return "O";
  if (!normalized || normalized === "NOT_SUBMITTED") return "미제출";
  return "X";
};

const normalizeHomeworkProblems = (problems: any[]) => {
  const latestOnTime = new Map<string, any>();
  const latestOnTimeCorrect = new Map<string, any>();
  const latestAny = new Map<string, any>();
  const firstCorrectAttemptByProblem = new Map<string, number>();

  const updateLatest = (map: Map<string, any>, key: string, item: any) => {
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

  problems.forEach((problem) => {
    const key = getProblemKey(problem);
    if (!key) return;

    const firstCorrectAttempt = Number(problem?.first_correct_attempt_count ?? 0);
    if (firstCorrectAttempt > 0) {
      const prevAttempt = firstCorrectAttemptByProblem.get(key);
      if (prevAttempt == null || firstCorrectAttempt < prevAttempt) {
        firstCorrectAttemptByProblem.set(key, firstCorrectAttempt);
      }
    }

    updateLatest(latestAny, key, problem);
    if (!problem?.is_late) {
      updateLatest(latestOnTime, key, problem);
      if (isCorrectStatus(problem?.status)) {
        updateLatest(latestOnTimeCorrect, key, problem);
      }
    }
  });

  const latestByProblem = new Map<string, any>();
  latestAny.forEach((latest, key) => {
    latestByProblem.set(
      key,
      latestOnTimeCorrect.get(key) ?? latestOnTime.get(key) ?? latest
    );
  });

  return { latestByProblem, firstCorrectAttemptByProblem };
};

interface StudentManageTabProps {
  data: any;
  isLoading: boolean;
  error: unknown;
  refetch: UseQueryResult<LectureMembersResponse, Error>["refetch"];
  lecInfo: any;
}
export default function StudentManageTab({
  data,
  isLoading,
  error,
  refetch,
  lecInfo,
}: StudentManageTabProps) {
  const params = useParams();

  const lectureId = String(params.classid ?? "");

  const [students, setStudents] = useState<Student[]>([]);
  const [tostTitle, setToastTitle] = useState("학생이 초대되었습니다");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { mutateAsync: addMembers } = useAddLectureMembers(lectureId);
  const members = useMemo(() => data ?? [], [data]);
  const gradeActivityParams = useMemo(
    () => ({
      startDate: toDateInputValue(lecInfo?.start_date),
      endDate: toDateInputValue(lecInfo?.end_date),
    }),
    [lecInfo?.end_date, lecInfo?.start_date]
  );
  const {
    data: homeworkGradeRes,
    isLoading: isHomeworkGradeLoading,
  } = useGetHomeworkSubmissions(lectureId, !!lectureId);
  const {
    data: examGradeRes,
    isLoading: isExamGradeLoading,
  } = useGetExamSubmissions(lectureId, undefined, !!lectureId);
  const {
    data: examsRaw,
    isLoading: isExamListLoading,
  } = useGetExams(lectureId);
  const {
    data: activityGradeRes,
    isLoading: isActivityGradeLoading,
  } = useGetLectureStudentActivity(lectureId, gradeActivityParams, {
    enabled: !!lectureId,
  });
  const exams = useMemo(
    () => (Array.isArray(examsRaw) ? examsRaw : []),
    [examsRaw]
  );

  const { mutateAsync: removeMember } = useRemoveLectureMember(lectureId);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    students[0]?.id ?? null
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewSize, setViewSize] = useState(10);

  const [modal, setModal] = useState<null | "bulk" | "add">(null);
  const [toastOpen, setToastOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const isGradeWorkbookLoading =
    isHomeworkGradeLoading ||
    isExamGradeLoading ||
    isExamListLoading ||
    isActivityGradeLoading;

  const gradeRoster = useMemo<GradeRosterRow[]>(() => {
    const rows: GradeRosterRow[] = members.map((m: any) => {
      const parsedUserId = Number(m.user_id);
      const userId = Number.isFinite(parsedUserId) ? parsedUserId : 0;
      const studentId = String(
        m.student_code ?? m.studentId ?? (looksLikeStudentId(m.name) ? m.name : "")
      );
      const rawName =
        m.full_name ?? (looksLikeStudentId(m.name) ? "" : m.name ?? "");
      const name = formatDisplayName(rawName);
      return {
        userId,
        name,
        studentId,
      };
    });

    rows.sort((a, b) => {
      const aId = a.studentId.trim();
      const bId = b.studentId.trim();
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
  }, [members]);

  const openInviteToast = () => {
    setToastOpen(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastOpen(false), 3000);
  };

  const idToUserIdRef = useRef<Map<number, string>>(new Map());

  // 검색 필터
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    return students.filter((s) =>
      `${s.name}${s.studentId}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  // 현재 화면에 보이는 학생 ids
  const visibleIds = filteredStudents.slice(0, viewSize).map((s) => s.id);

  // 체크 토글
  const onToggleCheck = (id: number, checked: boolean) => {
    setSelectedStudentIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  // 전체 체크 토글
  const onToggleAll = (checked: boolean) => {
    setSelectedStudentIds((prev) =>
      checked
        ? [...prev, ...visibleIds.filter((id) => !prev.includes(id))]
        : prev.filter((id) => !visibleIds.includes(id))
    );
  };


  // 삭제
  const performDeleteChecked = async () => {
    if (selectedStudentIds.length === 0) return;

    const targetsUserIds = Array.from(
      new Set(
        selectedStudentIds
          .map((id) => idToUserIdRef.current.get(id))
          .filter((v): v is string => typeof v === "string" && v !== "")
      )
    );
    if (targetsUserIds.length === 0) {
      // 필요하면 토스트/모달로 교체
      alert("삭제할 사용자 정보를 찾지 못했습니다.");
      return;
    }

    try {
      setDeleting(true);
      const results = await Promise.allSettled(
        targetsUserIds.map((userId) => removeMember(userId))
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;

      if (failed > 0) {
        // 실패 안내는 기존 토스트로 바꿔도 OK
        alert(`${failed}건 삭제 실패가 있었습니다. 잠시 후 다시 시도해주세요.`);
      }
      if (succeeded > 0) {
        await refetch();
      }
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setSelectedStudentIds([]); // 선택 해제
    }
  };

  // 삭제 모달 열기
  const handleDeleteChecked = async () => {
    if (selectedStudentIds.length === 0) return;
    setConfirmOpen(true);
  };

  const handleDownloadStudentTemplate = () => {
    const HEADERS = ["이름", "학번"];
    const EXAMPLE = [
      ["Student A", "STUDENT001"],
      ["Student B", "STUDENT002"],
      ["Student C", "STAFF001"],
    ];

    const buildCsvAndDownload = async () => {
      const XLSX = await import("xlsx");
      // CSV 내용 만들기
      const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...EXAMPLE]);
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ",", RS: "\r\n" }); // CRLF 권장

      // 파일명 (yyyyMMdd)
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const filename = `학생업로드_양식_${y}${m}${day}.csv`;

      // UTF-8 with BOM으로 저장 (엑셀 한글/UTF-8 호환)
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
    buildCsvAndDownload();
  };

  const handleDownloadGradeWorkbook = async () => {
    if (!homeworkGradeRes || !examGradeRes || !activityGradeRes) {
      alert("성적표 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();

    const examRows = Array.isArray(examGradeRes.data) ? examGradeRes.data : [];
    const examProblems = collectProblemColumns(
      examGradeRes.problem_catalog,
      examRows
    );
    const examBlocks = exams
      .map((exam: any, index: number) => {
        const id = String(exam?.id ?? exam?.uuid ?? index);
        const problems = examProblems.filter((problem) => problem.examId === id);
        return {
          id,
          title: String(exam?.exam_name ?? exam?.title ?? `시험 ${index + 1}`),
          problems,
          fallbackTotal: Number(exam?.problem_count ?? problems.length) || problems.length,
        };
      })
      .filter((block) => block.problems.length > 0 || block.fallbackTotal > 0);

    const assignedExamProblemIds = new Set(
      examBlocks.flatMap((block) => block.problems.map((problem) => problem.id))
    );
    const unassignedExamProblems = examProblems.filter(
      (problem) => !assignedExamProblemIds.has(problem.id)
    );
    if (unassignedExamProblems.length > 0) {
      examBlocks.push({
        id: "exam",
        title: "시험",
        problems: unassignedExamProblems,
        fallbackTotal: unassignedExamProblems.length,
      });
    }

    const examByUser = new Map<number, any>();
    examRows.forEach((row: any) => {
      const userId = Number(row?.user_id);
      if (Number.isFinite(userId)) examByUser.set(userId, row);
    });

    const examHeaderTop: (string | number)[] = ["이름", "학번"];
    const examHeaderSub: (string | number)[] = ["", ""];
    const examMerges: any[] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
    ];
    let examCol = 2;
    examBlocks.forEach((block) => {
      const blockWidth = 1 + block.problems.length * 2;
      const total = block.problems.length || block.fallbackTotal;
      examHeaderTop.push(block.title, ...Array(blockWidth - 1).fill(""));
      examHeaderSub.push(`점수(전체${total}개)`);
      block.problems.forEach((problem) => {
        examHeaderSub.push(`${problem.title} O/X`, `${problem.title} 점수`);
      });
      examMerges.push({
        s: { r: 0, c: examCol },
        e: { r: 0, c: examCol + blockWidth - 1 },
      });
      examCol += blockWidth;
    });

    const examSheetRows = gradeRoster.map((student) => {
      const submission = examByUser.get(student.userId);
      const problemById = new Map<string, any>();
      (Array.isArray(submission?.problems) ? submission.problems : []).forEach(
        (problem: any) => {
          const key = getProblemKey(problem);
          if (key) problemById.set(key, problem);
        }
      );

      const row: (string | number)[] = [student.name, student.studentId];
      examBlocks.forEach((block) => {
        const total = block.problems.length || block.fallbackTotal;
        const solved = block.problems.filter((problem) =>
          isCorrectStatus(problemById.get(problem.id)?.status)
        ).length;
        row.push(Math.min(solved, total));
        block.problems.forEach((problem) => {
          const current = problemById.get(problem.id);
          row.push(toWorkbookStatus(current), getProblemScore(current));
        });
      });
      return row;
    });
    const examWs = XLSX.utils.aoa_to_sheet([
      examHeaderTop,
      examHeaderSub,
      ...examSheetRows,
    ]);
    (examWs as any)["!merges"] = examMerges;
    XLSX.utils.book_append_sheet(workbook, examWs, "시험");

    const homeworkRows = Array.isArray(homeworkGradeRes.data)
      ? homeworkGradeRes.data
      : [];
    const homeworkProblems = collectProblemColumns(
      homeworkGradeRes.problem_catalog,
      homeworkRows
    );
    const homeworkTotalCount =
      homeworkProblems.length ||
      Math.max(
        0,
        ...homeworkRows.map((row: any) => Number(row?.total_count ?? 0) || 0)
      );
    const homeworkByUser = new Map<number, any>();
    homeworkRows.forEach((row: any) => {
      const userId = Number(row?.user_id);
      if (Number.isFinite(userId)) homeworkByUser.set(userId, row);
    });

    const homeworkHeader: (string | number)[] = [
      "이름",
      "학번",
      `점수(전체${homeworkTotalCount}개)`,
    ];
    homeworkProblems.forEach((problem) => {
      homeworkHeader.push(
        `${problem.title} O/X/미제출/지각`,
        `${problem.title} 점수`,
        `${problem.title} 제출횟수`,
        `${problem.title} 첫 정답시 제출횟수`
      );
    });

    const homeworkSheetRows = gradeRoster.map((student) => {
      const submission = homeworkByUser.get(student.userId);
      const normalized = normalizeHomeworkProblems(
        Array.isArray(submission?.problems) ? submission.problems : []
      );
      const solved =
        homeworkProblems.length > 0
          ? homeworkProblems.filter(
              (problem) =>
                toWorkbookStatus(normalized.latestByProblem.get(problem.id), true) === "O"
            ).length
          : Number(submission?.solved_count ?? 0) || 0;
      const row: (string | number)[] = [
        student.name,
        student.studentId,
        Math.min(solved, homeworkTotalCount),
      ];

      homeworkProblems.forEach((problem) => {
        const current = normalized.latestByProblem.get(problem.id);
        const status = toWorkbookStatus(current, true);
        row.push(
          status,
          status === "지각" ? 0 : getProblemScore(current),
          getAttemptCount(current),
          normalized.firstCorrectAttemptByProblem.get(problem.id) ?? ""
        );
      });
      return row;
    });
    const homeworkWs = XLSX.utils.aoa_to_sheet([
      homeworkHeader,
      ...homeworkSheetRows,
    ]);
    XLSX.utils.book_append_sheet(workbook, homeworkWs, "과제");

    const activityRows = [...(activityGradeRes.data ?? [])].sort((a, b) =>
      String(a.student_code ?? "").localeCompare(
        String(b.student_code ?? ""),
        "ko",
        { numeric: true, sensitivity: "base" }
      )
    );
    const activitySheetRows: (string | number)[][] = activityRows.map((row) => [
      row.full_name || "-",
      row.student_code ?? "",
      Number(row.post_count ?? 0),
      Number(row.reply_count ?? 0),
      Number(row.total_count ?? 0),
    ]);
    const activitySummary = activityGradeRes.summary ?? {
      post_count: 0,
      reply_count: 0,
      total_count: 0,
    };
    activitySheetRows.push([
      "합계",
      "",
      Number(activitySummary.post_count ?? 0),
      Number(activitySummary.reply_count ?? 0),
      Number(activitySummary.total_count ?? 0),
    ]);
    const activityWs = XLSX.utils.aoa_to_sheet([
      ["이름", "학번", "게시글", "댓글", "총 활동"],
      ...activitySheetRows,
    ]);
    XLSX.utils.book_append_sheet(workbook, activityWs, "활동집계");

    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const safeLectureName = sanitizeFilename(lecInfo?.name || "");
    const lectureLabel = safeLectureName || lectureId;
    XLSX.writeFile(workbook, `${lectureLabel}_성적표_${y}${m}${day}.xlsx`);
  };

  // 학생 여러 명 추가
  const handleAddStudents = async (sidArr: string[]) => {
    const newIds = sidArr
      .flatMap((s) => s.split(/[\s,]+/))
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((id) => looksLikeStudentId(id));

    const normalizedNewIds = Array.from(
      new Set(newIds.map((id) => normalizeStudentId(id)))
    );

    const existingIds = students
      .map((s) => normalizeStudentId(s.studentId))
      .filter((v): v is string => !!v);
    const existingSet = new Set(existingIds);
    const addTargets = normalizedNewIds.filter((id) => !existingSet.has(id));

    if (addTargets.length === 0) {
      setToastTitle("이미 등록된 학생입니다");
      openInviteToast();
      setModal(null);
      return;
    }

    const payload = addTargets.map((student_id) => ({ student_id }));

    try {
      await addMembers({ members: payload });
      setToastTitle("학생이 초대되었습니다");
      openInviteToast();

      await refetch();
      setModal(null);
    } catch {
      alert("학생 추가에 실패했습니다. 학번을 확인해주세요.");
    }
  };

  useEffect(() => {
    const map = new Map<number, string>();
    const usedIds = new Set<number>();
    let tempId = -1;
    const makeUniqueId = (candidate?: number) => {
      if (
        Number.isFinite(candidate) &&
        (candidate as number) > 0 &&
        !usedIds.has(candidate as number)
      ) {
        usedIds.add(candidate as number);
        return candidate as number;
      }
      while (usedIds.has(tempId)) tempId -= 1;
      usedIds.add(tempId);
      return tempId--;
    };

    const mapped: Student[] = members.map((m: any, idx: number) => {
      // user_id가 중복되는 케이스(매칭 중복 등)로 체크가 같이 되는 문제 방지
      const id = makeUniqueId(idx + 1);
      const memberKey =
        m.uuid ?? (m.user_id != null && m.user_id !== ""
          ? String(m.user_id)
          : String(m.student_code ?? ""));
      map.set(id, memberKey);

      // 학번: student_code 우선, 없으면 name이 숫자면 name 사용
      const studentId =
        m.student_code ?? (looksLikeStudentId(m.name) ? m.name : "");

      // 표시 이름: full_name 우선, 없으면 name이 숫자가 아니면 name 사용
      const rawName =
        m.full_name ?? (looksLikeStudentId(m.name) ? "" : m.name ?? "");
      const displayName = formatDisplayName(rawName);

      return { id, name: displayName, studentId };
    });
    mapped.sort((a, b) => {
      const aId = (a.studentId ?? "").toString().trim();
      const bId = (b.studentId ?? "").toString().trim();
      if (aId && bId) {
        return aId.localeCompare(bId, "ko", { numeric: true, sensitivity: "base" });
      }
      if (aId) return -1;
      if (bId) return 1;
      return 0;
    });
    idToUserIdRef.current = map;
    setStudents(mapped);
    setSelectedStudentId(mapped[0]?.id ?? null);
    setSelectedStudentIds([]);
  }, [members]);

  const manageActionBtnBaseClass =
    "font-kr inline-flex fluid-control-h w-auto items-center justify-center whitespace-nowrap rounded-[10px] border bg-white px-[clamp(10px,0.9vw,14px)] text-[clamp(11px,0.72vw,13px)] font-medium transition-colors active:scale-95";

  return (
    <>
      <SuccessToast
        open={toastOpen}
        title={tostTitle}
        desc={"목록에서 확인해보세요"}
      />
      <section className="min-h-[400px] bg-transparent font-kr">
        <p className="mb-6">
          학생 등록/삭제/조회 및 개별 학습 이력을 확인할 수 있습니다.
        </p>

        {/* 상단 툴바 예시 */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center text-[16px] font-bold text-[#6D717F] font-kr">
            <span>전체인원: {students.length}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className={`${manageActionBtnBaseClass} border-indigo-300 text-indigo-600 hover:bg-indigo-50`}
              onClick={handleDownloadStudentTemplate}
            >
              양식 다운로드
            </button>
            <button
              onClick={() => setModal("bulk")}
              className={`${manageActionBtnBaseClass} border-blue-300 text-blue-600 hover:bg-blue-50`}
            >
              학생 일괄 업로드
            </button>

            <button
              onClick={() => setModal("add")}
              className={`${manageActionBtnBaseClass} border-cyan-300 text-cyan-700 hover:bg-cyan-50`}
            >
              학생 추가
            </button>
          </div>
        </div>

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleDownloadGradeWorkbook}
            disabled={isGradeWorkbookLoading}
            className={`${manageActionBtnBaseClass} border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            성적표 다운로드
          </button>
        </div>

        {/* 좌우 레이아웃 */}
        <div className="flex flex-col lg:flex-row gap-4">
          <StudentManageLeft
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            viewSize={viewSize}
            setViewSize={setViewSize}
            filteredStudents={filteredStudents}
            isLoading={isLoading}
            visibleIds={visibleIds}
            selectedStudentIds={selectedStudentIds}
            onToggleCheck={onToggleCheck}
            onToggleAll={onToggleAll}
            setSelectedStudentId={setSelectedStudentId}
            handleDeleteChecked={handleDeleteChecked}
            refetch={refetch}
          />

          <StudentManageRight
            student={students.find((s) => s.id === selectedStudentId) ?? null}
            userId={
              Number(idToUserIdRef.current.get(Number(selectedStudentId))) || 0
            }
            lectureId={lectureId}
          />
        </div>

        {/* 모달들 */}
        {modal === "bulk" && (
          <BulkUploadModal
            open={true}
            onClose={() => setModal(null)}
            onUpload={async (rows) => {
              const map = new Map<
                string,
                { student_id: string; name?: string }
              >();

              for (const r of rows) {
                const id = (r.studentId ?? "").toString().trim();
                if (!looksLikeStudentId(id)) continue; // 학번/사번/교번 형식(6자리 이상 숫자 또는 admin 스타일)

                const name = (r.name ?? "").trim();

                // 동일 학번이 여러 번 나오면, 마지막 값으로 갱신(또는 비어있지 않은 값 우선)
                const prev = map.get(id) ?? { student_id: id };
                map.set(id, {
                  student_id: id,
                  name: name || prev.name, // 비어있지 않은 값 우선
                });
              }

              const membersFromFile = Array.from(map.values());
              const existingIds = students
                .map((s) => normalizeStudentId(s.studentId))
                .filter((v): v is string => !!v);
              const existingSet = new Set(existingIds);
              const targetMembers = membersFromFile.filter((member) => {
                const normalized = normalizeStudentId(member.student_id);
                return !!normalized && !existingSet.has(normalized);
              });
              const normalizedMembers = targetMembers.map((member) => ({
                student_id: normalizeStudentId(member.student_id),
              }));

              if (normalizedMembers.length === 0) {
                setToastTitle("추가할 학번이 없습니다");
                openInviteToast();
                setModal(null);
                return;
              }

              // 2) PUT: 파일 내용으로 추가/갱신
              try {
                await addMembers({
                  members: normalizedMembers,
                });
                setToastTitle("업로드에 성공하였습니다");
                openInviteToast();

                await refetch();
                setModal(null);
              } catch {
                alert("업로드에 실패했습니다. 학번을 확인해주세요.");
              }
            }}
          />
        )}
        {modal === "add" && (
          <AddStudentModal
            isOpen={true}
            onSubmit={handleAddStudents}
            onClose={() => setModal(null)}
          />
        )}
      </section>
      <ConfirmDeleteModal
        open={confirmOpen}
        count={selectedStudentIds.length}
        loading={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={performDeleteChecked}
      />
    </>
  );
}
