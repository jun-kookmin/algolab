// ──── FILE: src/app/class/[classid]/page.tsx ────
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import StudentSection from "@/components/class/StudentSection";
import StudentSectionExam from "@/components/class/StudentSection_exam";
import type { ClassProblem } from "@/types/class";
import { useGetLecture, type Lecture } from "@/hooks/lectures/Get/useGetLecture";
import { useGetHomeworks } from "@/hooks/lectures/Get/useGetHomeworks";
import { useGetExams } from "@/hooks/lectures/Get/useGetExams";
import { useMe } from "@/hooks/auth/get/useMe"
import { coerceBoolean } from "@/utils/boolean";
import { useServerNowMs } from "@/hooks/useServerNowMs";
import type { HomeworkSection } from "@/hooks/lectures/Get/useGetHomeworks";
import type { ExamItem } from "@/hooks/lectures/Get/useGetExams";

/* 섹션 구조 정의 (학생 페이지 전용, 읽기 전용) */
interface SectionState {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  isExam: boolean;
  isOpen: boolean;
  problems: ClassProblem[];
}

/* 로컬스토리지 키 */
const LOCAL_STORAGE_KEY = "sectionsData";

/* 💡 동적 시간 대신 고정 ISO 문자열 사용 (SSR/CSR 동일) */
const FIXED_TIME = "2025-01-01T00:00";
const PRE_EXAM_LOCK_MINUTES = 5;
const POST_EXAM_LOCK_MINUTES = 5;

type TabKey = "curriculum" | "exam";

const EMPTY_LIST: any[] = [];

const isSameOpenState = (
  a: Record<string, boolean>,
  b: Record<string, boolean>
) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

export default function StudentClassPage({
  initialLecture,
  initialHomeworks,
  initialExams,
}: {
  initialLecture?: Lecture;
  initialHomeworks?: HomeworkSection[];
  initialExams?: ExamItem[];
}) {
  const params = useParams<{ classid: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const classId = String(params?.classid ?? "");
  const sectionStorageKey = `${LOCAL_STORAGE_KEY}:${classId}`;

  // classId로 과목명 로딩. 없을 시 기본값 사용
  const { data } = useGetLecture(classId ?? undefined, {
    initialData: initialLecture,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const courseName = data?.name ?? "과목명";
  const curriculumLocked = coerceBoolean(data?.curriculum_locked);
  const serverNowMs = useServerNowMs(data?.server_time, 1000);

  // hook 사용에 따라 isOpen 기능 분리
  const [hwIsOpen, setHwIsOpen] = useState<Record<string, boolean>>({});
  const [exIsOpen, setExIsOpen] = useState<Record<string, boolean>>({});

  // classId로 lecture 내부 homework와 exam 로딩. ID 겹침 문제를 피하기 위해 두 개의 list로 분리.
  const { data: homeworksData } = useGetHomeworks(classId, {
    initialData: initialHomeworks ? { homeworks: initialHomeworks } : undefined,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const { data: examsData } = useGetExams(classId, {
    initialData: initialExams
      ? { exam: initialExams, results: initialExams }
      : undefined,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const homeworks = homeworksData ?? EMPTY_LIST;
  const exams = examsData ?? EMPTY_LIST;

  const { data: me } = useMe();
  const group = (me?.group ?? "").toLowerCase();
  const isProfessor = group === "administrator" || group === "professor" || group === "instructor";
  const parseEndDate = (value?: string) => {
    if (!value) return null;
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  };
  const lectureEnded = useMemo(() => {
    const endDate = parseEndDate(data?.end_date);
    if (!endDate || serverNowMs === null) return false;
    return serverNowMs > endDate.getTime();
  }, [data?.end_date, serverNowMs]);
  const solveBlocked = lectureEnded && !isProfessor;
  const homeworkReadOnly = lectureEnded && !isProfessor;
  const homeworkBlocked = curriculumLocked && !isProfessor;
  const homeworkBlockReason = curriculumLocked
    ? "커리큘럼 접근이 제한되었습니다."
    : "지난 강의는 조회 전용입니다.";

  const tabParam = searchParams?.get("tab");

  const parseDateTime = (value?: string): number | null => {
    if (!value) return null;
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    return d.getTime();
  };

  useEffect(() => {
    if (typeof window === "undefined" || !classId) return;

    try {
      const raw = window.localStorage.getItem(sectionStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        hwIsOpen?: Record<string, boolean>;
        exIsOpen?: Record<string, boolean>;
      };

      const hwIds = new Set(homeworks.map((hw) => hw.id));
      const exIds = new Set(exams.map((ex) => ex.id));

      const nextHwIsOpen: Record<string, boolean> = {};
      const nextExIsOpen: Record<string, boolean> = {};

      Object.entries(parsed?.hwIsOpen ?? {}).forEach(([id, value]) => {
        if (hwIds.has(id) && typeof value === "boolean") {
          nextHwIsOpen[id] = value;
        }
      });

      Object.entries(parsed?.exIsOpen ?? {}).forEach(([id, value]) => {
        if (exIds.has(id) && typeof value === "boolean") {
          nextExIsOpen[id] = value;
        }
      });

      setHwIsOpen((prev) =>
        isSameOpenState(prev, nextHwIsOpen) ? prev : nextHwIsOpen
      );
      setExIsOpen((prev) =>
        isSameOpenState(prev, nextExIsOpen) ? prev : nextExIsOpen
      );
    } catch {
      // console.warn("섹션 열림 상태 복원 실패:", err);
    }
  }, [classId, sectionStorageKey, homeworks, exams]);

  useEffect(() => {
    if (typeof window === "undefined" || !classId) return;
    const toStore = {
      hwIsOpen,
      exIsOpen,
    };
    window.localStorage.setItem(sectionStorageKey, JSON.stringify(toStore));
  }, [classId, sectionStorageKey, hwIsOpen, exIsOpen]);

  const syncTabParam = (tab: TabKey) => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (tab === "curriculum") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const nextQuery = params.toString();
    const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentPath = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    if (nextPath !== currentPath) {
      router.replace(nextPath);
    }
  };

  const hasActiveExam = useMemo(() => {
    if (!exams || exams.length === 0 || serverNowMs === null) return false;
    const now = serverNowMs;
    return exams.some((ex) => {
      const start = parseDateTime(ex.start_date);
      const end = parseDateTime(ex.due_date);
      if (start == null || end == null) return false;
      return (
        now >= start - PRE_EXAM_LOCK_MINUTES * 60 * 1000 &&
        now <= end + POST_EXAM_LOCK_MINUTES * 60 * 1000
      );
    });
  }, [exams, serverNowMs]);

  const lockCurriculum = (hasActiveExam || curriculumLocked) && !isProfessor;
  /* 탭 상태 */
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam === "exam" ? "exam" : "curriculum"
  );

  useEffect(() => {
    if (tabParam === "exam" || tabParam === "curriculum") {
      setActiveTab(tabParam as TabKey);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!lockCurriculum) return;
    if (activeTab !== "exam") {
      setActiveTab("exam");
      syncTabParam("exam");
    }
  }, [lockCurriculum, activeTab, pathname, router, searchParams]);


  const hwSections: SectionState[] = useMemo(
    () =>
      homeworks.map((hw) => ({
        id: hw.id,
        title: hw.title ?? "과제",
        description: hw.description,
        isExam: false,
        isOpen: !!hwIsOpen[hw.id],
        problems: [],
      })),
    [homeworks, hwIsOpen]
  );

  const exSections: SectionState[] = useMemo(
    () =>
      exams.map((ex) => ({
        id: ex.id,
        title: ex.exam_name ?? "시험",
        description: ex.description,
        end_date: ex.due_date,
        start_date: ex.start_date,
        isExam: true,
        isOpen: !!exIsOpen[ex.id],
        problems: [],
      })),
    [exams, exIsOpen]
  );

  /* 현재 탭에 따라 표시할 섹션 필터 */
  const visibleSections = useMemo(
    () => (activeTab === "exam" ? exSections : hwSections),
    [activeTab, exSections, hwSections]
  );

  /* 섹션 열고 닫기 (학생 페이지에서 열람만 가능) */
  const toggleSection = (sectionId: string) => {
    if (activeTab === "exam") {
      setExIsOpen((prev) => ({
        ...prev,
        [sectionId]: !(prev[sectionId] ?? false),
      }));
    } else {
      setHwIsOpen((prev) => ({
        ...prev,
        [sectionId]: !(prev[sectionId] ?? false),
      }));
    }
  };

  /* /edit로 이동 */
  const handleGoToEditPage = () => {
    if(isProfessor){
      const base = pathname.replace(/\/$/, "");
      router.push(`${base}/edit?tab=${activeTab}`);
    }
  };

  const hanedleGoToCommunity = () => {
    router.push(`/community`);
  }

  const horizontalPaddingClass = "fluid-space-x";
  const topActionBtnClass =
    "font-kr inline-flex fluid-control-h whitespace-nowrap items-center justify-center rounded-[10px] border border-indigo-300 bg-white px-[clamp(10px,0.9vw,14px)] text-[clamp(11px,0.72vw,13px)] font-medium text-indigo-600 hover:bg-indigo-50 active:scale-95";

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
    >
      <div className="sticky top-0 z-30 bg-white pt-3">
        <div className={`mx-auto w-full max-w-[1500px] ${horizontalPaddingClass}`}>
          <div className="pb-2 shadow-[0_1px_0_0_rgba(0,0,0,0.18)]">
            {/* 과목 정보 */}
            <div className="font-kr mb-0 pt-[2px] text-sm font-bold text-indigo-700">
              {courseName}
            </div>
          </div>

          {/* 헤더 + 탭 */}
          <div className="relative mb-10 pt-10">
            <div className="flex items-center gap-4">
              <div className="mb-6 flex gap-6">
                <button
                  onClick={() => {
                    if (lockCurriculum) {
                      setActiveTab("exam");
                      syncTabParam("exam");
                      return;
                    }
                    setActiveTab("curriculum");
                    syncTabParam("curriculum");
                  }}
                  className={`font-kr px-[clamp(8px,0.95vw,16px)] py-[clamp(6px,0.7vw,10px)] text-[clamp(1.5rem,2vw,1.875rem)] font-bold transition-colors ${
                    activeTab === "curriculum"
                      ? "text-gray-800 border-t-2 border-gray-800"
                      : "text-gray-400"
                  }`}
                >
                  커리큘럼
                </button>
                <button
                  onClick={() => {
                    setActiveTab("exam");
                    syncTabParam("exam");
                  }}
                  className={`font-kr px-[clamp(8px,0.95vw,16px)] py-[clamp(6px,0.7vw,10px)] text-[clamp(1.5rem,2vw,1.875rem)] font-bold transition-colors ${
                    activeTab === "exam"
                      ? "text-gray-800 border-t-2 border-gray-800"
                      : "text-gray-400"
                  }`}
                >
                  시험
                </button>
              </div>
            </div>

            {/* 구분 경계 우측 상단 버튼 */}
            <div className="absolute bottom-0 right-0 flex gap-2">
              {isProfessor && (
                <button
                  type="button"
                  onClick={handleGoToEditPage}
                  className={`${topActionBtnClass} w-[clamp(70px,5.6vw,88px)]`}
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={hanedleGoToCommunity}
                className={`${topActionBtnClass} w-[clamp(106px,8.4vw,138px)]`}
              >
                통합 게시판
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full -mt-10 flex-1 overflow-auto bg-[rgba(237,239,254,1)] pt-10">
        <div className={`mx-auto w-full max-w-[1500px] ${horizontalPaddingClass}`}>
          <div className="pt-4 pb-20">
            {/* 섹션 리스트 (탭 필터 적용) */}
            {activeTab === "exam"
              ? visibleSections.map((section, idx) => (
                  <StudentSectionExam
                    key={section.id}
                    id={section.id}
                    classId={classId}
                    examId={section.id}
                    displayNo={idx + 1}
                    title={section.title}
                    description={section.description}
                    start_date={section.start_date ?? FIXED_TIME}
                    end_date={section.end_date ?? FIXED_TIME}
                    serverNowMs={serverNowMs}
                    solveBlocked={solveBlocked}
                    isOpen={section.isOpen}
                    onToggle={() => toggleSection(section.id)}
                  />
                ))
              : visibleSections.map((section, idx) => (
                  <StudentSection
                    key={section.id}
                    id={section.id}
                    classId={classId}
                    homeworkId={section.id}
                    displayNo={idx + 1}
                    title={section.title}
                    description={section.description}
                    solveBlocked={homeworkBlocked}
                    readOnlyMode={homeworkReadOnly}
                    blockReason={homeworkBlockReason}
                    serverNowMs={serverNowMs}
                    isOpen={section.isOpen}
                    onToggle={() => toggleSection(section.id)}
                    canViewSolveStatus={true}
                  />
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
