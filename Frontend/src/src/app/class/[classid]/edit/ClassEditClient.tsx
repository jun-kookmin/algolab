// ──── FILE: app/class/[classid]/edit/page.tsx ────
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import dynamic from "next/dynamic";
import SectionModal from "@/components/class/SectionModal";
import { ClassProblem } from "@/types/class";

import { useGetLecture } from "@/hooks/lectures/Get/useGetLecture";
import { useGetHomeworks } from "@/hooks/lectures/Get/useGetHomeworks";
import { useGetExams } from "@/hooks/lectures/Get/useGetExams";
import { useAddHomework } from "@/hooks/lectures/Put/useAddHomework";
import { useAddExam } from "@/hooks/lectures/Put/useAddExam";
import { useRemoveHomework } from "@/hooks/lectures/Delete/useRemoveHomework";
import { useRemoveExam } from "@/hooks/lectures/Delete/useRemoveExam";
import { toast } from "react-toastify";

const WeekSection = dynamic(() => import("@/components/class/Section"), {
  ssr: false,
  loading: () => (
    <div className="p-6 text-center text-sm text-gray-500">
      섹션 로딩 중...
    </div>
  ),
});

const ExamSection = dynamic(() => import("@/components/class/ExamSection"), {
  ssr: false,
  loading: () => (
    <div className="p-6 text-center text-sm text-gray-500">
      섹션 로딩 중...
    </div>
  ),
});

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

type TabKey = "curriculum" | "exam";
type SectionSchedule = {
  start_date?: string;
  due_date?: string;
};

export default function ClassPage() {
  const router = useRouter();
  // -------------------------------
  // 쿼리 파라미터로 classId 읽기
  // -------------------------------
  const params = useParams();
  const pathname = usePathname();
  const classId = String(params.classid ?? "");

  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam === "exam" ? "exam" : "curriculum"
  );
  const [capturedTab, setCapturedTab] = useState<TabKey>(activeTab);

  useEffect(() => {
    if (tabParam === "exam" || tabParam === "curriculum") {
      setActiveTab(tabParam as TabKey);
    }
  }, [tabParam]);

  const syncTabParam = (tab: TabKey) => {
    const basePath = pathname ?? "";
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (tab === "curriculum") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const nextPath = `${basePath}${params.toString() ? `?${params.toString()}` : ""}`;
    const currentPath = `${basePath}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (nextPath !== currentPath) {
      router.replace(nextPath);
    }
  };

  // classId로 과목명 로딩. 없을 시 기본값 사용
  const { data } = useGetLecture(classId ?? undefined);
  const courseName = data?.name ?? "과목명";

  // hook 사용에 따라 isOpen 기능 분리
  const [hwIsOpen, setHwIsOpen] = useState<Record<string, boolean>>({});
  const [exIsOpen, setExIsOpen] = useState<Record<string, boolean>>({});
  const [homeworkScheduleById, setHomeworkScheduleById] = useState<
    Record<string, SectionSchedule>
  >({});

  // API 선언
  const addHomework = useAddHomework(classId);

  const addExam = useAddExam(classId);

  // classId로 lecture 내부 homework와 exam 로딩. ID 겹침 문제를 피하기 위해 두 개의 list로 분리.
  const [modalOpen, setModalOpen] = useState(false);

  const shouldFetchHomeworks = activeTab === "curriculum";
  const shouldFetchExams = activeTab === "exam";

  const { data: homeworks = [] } = useGetHomeworks(classId, {
    enabled: shouldFetchHomeworks,
  });
  const removeHomework = useRemoveHomework(classId);
  const { data: exams = [] } = useGetExams(classId, {
    enabled: shouldFetchExams,
  });
  const removeExam = useRemoveExam(classId);

  const hwSections: SectionState[] = useMemo(
    () =>
      homeworks.map((hw) => ({
        id: hw.id,
        title: hw.title ?? "과제",
        description: hw.description,
        start_date: homeworkScheduleById[hw.id]?.start_date ?? hw.start_date,
        end_date: homeworkScheduleById[hw.id]?.due_date ?? hw.end_date,
        isExam: false,
        isOpen: !!hwIsOpen[hw.id],
        problems: [],
      })),
    [homeworks, homeworkScheduleById, hwIsOpen]
  );

  const exSections: SectionState[] = useMemo(
    () =>
      exams.map((ex) => ({
        id: ex.id,
        title: ex.exam_name ?? "시험",
        description: ex.description,
        due_date: ex.due_date,
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

  /* 새 섹션 추가 — API연동*/
  const handleCreateSection = (
    title: string,
    description: string,
    _isExamDefault?: boolean,
    schedule?: SectionSchedule
  ) => {
    if (capturedTab === "exam") {
      const toastEXID = toast.info("새 시험을 생성 중입니다...");
      addExam.mutate({
        exam_name: title ?? "시험",
        description: description ?? "시험 설명입니다.",
        start_date: schedule?.start_date,
        due_date: schedule?.due_date,
      },
      {
        onError: () => { toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요."); },
        onSuccess: () => { toast.success("새 시험이 생성되었습니다!"); },
        onSettled: () => { toast.dismiss(toastEXID); }
      });
    }
    else{
      const toastHWID = toast.info("새 과제를 생성 중입니다...");
      addHomework.mutate(
        {
          name: title ?? "과제",
          description: description ?? "과제 설명입니다.",
          start_date: schedule?.start_date,
          end_date: schedule?.due_date,
        },
        {
          onError: () => {
            toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
          },
          onSuccess: (created) => {
            if (schedule?.start_date || schedule?.due_date) {
              const createdId = String(created?.id ?? created?.uuid ?? "");
              if (createdId) {
                setHomeworkScheduleById((prev) => ({
                  ...prev,
                  [createdId]: schedule,
                }));
              }
            }
            toast.success("새 과제가 생성되었습니다!");
          },
          onSettled: () => {
            toast.dismiss(toastHWID);
          },
        }
      );
    }
    setModalOpen(false);
  };

  /* 섹션 열림/닫힘 토글 */
  const handleToggleHomeworkSection = (homeworkId: string) => {
    setHwIsOpen((prev) => ({
      ...prev,
      [homeworkId]: !(prev[homeworkId] ?? false),
    }));
  };

  const handleToggleExamSection = (examId: string) => {
    setExIsOpen((prev) => ({ ...prev, [examId]: !(prev[examId] ?? false) }));
  };

  /* 섹션 삭제 */

  /* 섹션 삭제 */
  const handleDeleteHomeworkSection = (homeworkId: string) => {
    const toastHWDelID = toast.info("과제를 삭제 중입니다...");
    removeHomework.mutate(homeworkId, {
      onError: () => {
        toast.error(
          "과제 삭제 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      },
      onSuccess: () => {
        toast.success("과제가 삭제되었습니다!");
      },
      onSettled: () => {
        toast.dismiss(toastHWDelID);
      },
    });
  };

  const handleDeleteExamSection = (examId: string) => {
    const toastEXDelID = toast.info("시험을 삭제 중입니다...");
    removeExam.mutate(examId, {
      onError: () => {
        toast.error(
          "시험 삭제 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      },
      onSuccess: () => {
        toast.success("시험이 삭제되었습니다!");
      },
      onSettled: () => {
        toast.dismiss(toastEXDelID);
      },
    });
  };

  /* 학생 페이지로 이동 */
  const handleGoToStudentPage = () => {
    router.push(`/class/${classId}?tab=${activeTab}`);
  };

  const horizontalPaddingClass = "fluid-space-x";
  const topActionBtnClass =
    "font-kr inline-flex fluid-control-h whitespace-nowrap items-center justify-center rounded-[10px] border border-indigo-300 bg-white px-[clamp(10px,0.9vw,14px)] text-[clamp(11px,0.72vw,13px)] font-medium text-indigo-600 hover:bg-indigo-50 active:scale-95";

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white font-kr">
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
              {/* 좌측: 탭 */}
              <div className="mb-6 flex gap-6">
                <button
                  onClick={() => {
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
              <button
                type="button"
                onClick={handleGoToStudentPage}
                className={`${topActionBtnClass} w-[clamp(112px,9vw,148px)]`}
              >
                학생 화면 보기
              </button>
              <button
                type="button"
                onClick={() => {
                  setCapturedTab(activeTab);
                  setModalOpen(true);
                }}
                className={`${topActionBtnClass} w-[clamp(76px,6vw,94px)]`}
              >
                {activeTab === "exam" ? "시험 추가" : "과제 추가"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full -mt-10 flex-1 overflow-y-auto overflow-x-hidden bg-[rgba(237,239,254,1)] pt-10">
        <div className={`mx-auto w-full max-w-[1500px] ${horizontalPaddingClass}`}>
          <div className="pt-4 pb-20">
            {/* 섹션 리스트 (탭 필터 적용) */}
            {activeTab === "exam"
              ? visibleSections.map((section, idx) => (
                  // 시험 섹션
                  <ExamSection
                    key={section.id}
                    classId={classId}
                    examId={section.id}
                    displayNo={idx + 1}
                    {...section}
                    onToggle={() => handleToggleExamSection(section.id)}
                    onDelete={() => handleDeleteExamSection(section.id)}
                  />
                ))
              : visibleSections.map((section, idx) => (
                  // 과제 섹션
                  <WeekSection
                    key={section.id}
                    classId={classId}
                    homeworkId={section.id}
                    displayNo={idx + 1}
                    {...section}
                    onToggle={() => handleToggleHomeworkSection(section.id)}
                    onDelete={() => handleDeleteHomeworkSection(section.id)}
                  />
                ))}
          </div>
        </div>
      </div>

      {/* 새 섹션 생성 모달 */}
      <SectionModal
        open={modalOpen}
        onSave={handleCreateSection}
        onClose={() => setModalOpen(false)}
        examLocked={capturedTab === "exam"}
      />
    </section>
  );
}
