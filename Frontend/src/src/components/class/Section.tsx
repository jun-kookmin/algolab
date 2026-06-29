// ──── FILE: src/components/Section.tsx ────
"use client";

import React, { useState } from "react";
import Image from "next/image";
import DeleteModal from "@/components/class/DeleteModal";
import dynamic from "next/dynamic";

import { HomeworkProblem, Question } from "@/types/class";
import { useQueryClient } from "@tanstack/react-query";
import { useGetHomework } from "@/hooks/lectures/Get/useGetHomework";
import { useUpdateHomework } from "@/hooks/lectures/Update/useUpdateHomework";
import { LANGUAGES, mapLanguagesNum, toLanguageFromName, type Language } from "@/types/languages";
import { useGetLecture } from "@/hooks/lectures/Get/useGetLecture";
import { Btn } from "@/components/assets/Btn";
import { validateDateTimeRange } from "@/utils/dateTimeLocal";
import { toast } from "react-toastify";

const ProblemImportModal = dynamic(
  () => import("@/components/class/ProblemImportModal/ProblemImportModal"),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-center text-sm text-gray-500">
        모달 로딩 중...
      </div>
    ),
  }
);

/* ── 아이콘 경로 ( public/… ) ───────────────────────── */
const ExternalIcon = "/assets/icon/Icon_ShortCut.svg";
const TrashIcon = "/assets/icon/Icon_TrashCan.svg";
const UpIcon = "/assets/icon/Icon_Up.svg";
const DownIcon = "/assets/icon/Icon_Down.svg";

/* ── 공통 Image 래퍼 ─────────────────────────────────── */
interface IconProps {
  src: string;
  alt?: string;
  size?: number;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
}

const IconImg: React.FC<IconProps> = ({
  src,
  alt = "",
  size = 16,
  className = "",
  ...rest
}) => (
  <Image
    src={src}
    alt={alt}
    width={size}
    height={size}
    unoptimized
    className={className}
    {...rest}
  />
);
/* ───────────────────────────────────────────────────── */

export interface WeekSectionProps {
  id: string;
  classId: string; // API 호출용
  homeworkId: string; // API 호출용
  displayNo: number;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

/* ── 유틸 ────────────────────────────────────────────── */
const pad = (n: number) => n.toString().padStart(2, "0");
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(
    d.getDate()
  )}. (${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())})`;
};
const isTempId = (id: string) => id.startsWith("temp-");

const IconButton: React.FC<{ label: string; onClick?: () => void }> = ({
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="font-kr flex items-center gap-1 rounded-md bg-gray-100
       px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 active:scale-95"
  >
    {label}
  </button>
);

type SectionProblemPayload = {
  uuid?: string;
  problem_uuid: string;
  language: number[];
  start_date: string;
  end_date: string;
  points?: number;
};

/** 문제 하나의 행 (커리큘럼 전용: 시험 관련 표시 제거) */
const ProblemRow: React.FC<{
  problem: HomeworkProblem;
  onUpdate: (f: (p: HomeworkProblem) => HomeworkProblem) => void;
  onDelete: () => void;
}> = ({ problem, onUpdate, onDelete }) => {
  const handleTitleClick = () => {
    // TODO: 여기 이벤트 추가
    // console.log("[Curriculum] 문제 ID:", problem.id);
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [startTime, setStartTime] = useState(problem.startAt);
  const [endTime, setEndTime] = useState(problem.endAt);
  const [tempPoint, setTempPoint] = useState(problem.points);

  // props가 바뀌면 로컬 state도 동기화
  React.useEffect(() => {
    setStartTime(problem.startAt);
    setEndTime(problem.endAt);
    setTempPoint(problem.points);
  }, [problem.startAt, problem.endAt, problem.points]);
  
  return (
    <>
      <div className="flex items-center gap-3 border-b border-b-gray-200 px-5 py-2 last:border-b-0">
        {/* 사용하지 않아 우선 주석 처리
        <input
          type="checkbox"
          className="h-4 w-4 accent-indigo-600"
          checked={!!problem.checked}
          onChange={() => onUpdate((p) => ({ ...p, checked: !p.checked }))}
        />
        */}
        {/* 제목 */}
        <div className="flex flex-1 flex-col text-[12px]">
          <span
            className="flex cursor-pointer items-center font-kr font-medium text-gray-800 hover:underline"
            onClick={handleTitleClick}
          >
            {problem.title}
          </span>
          <span className="font-kr text-gray-500">
            {formatDate(problem.startAt)} ~ {formatDate(problem.endAt)}
          </span>
        </div>

        {/* 시작/마감 · 배점 */}
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="h-6 w-[160px] rounded border border-gray-200 px-1 text-[11px]"
        />
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="h-6 w-[160px] rounded border border-gray-200 px-1 text-[11px]"
        />
        <span className="mx-2 font-kr text-xs text-gray-500">배점</span>
        <input
          type="number"
          value={tempPoint}
          onChange={ (e) => setTempPoint(Number(e.target.value)) }
          className="h-8 w-16 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-right text-xs focus:border-indigo-500"
        />

        <Btn
          text="적용"
          onClick={() => {
            const validation = validateDateTimeRange(startTime, endTime);
            if (!validation.ok) {
              toast.error(validation.message);
              return;
            }
            onUpdate((prev) => ({
              ...prev,
              startAt: startTime,
              endAt: endTime,
              points: tempPoint,
            }));
          }}
          textSize="text-xs"
          height="h-6"
          width="w-12"
        />

        <IconImg
          src={ExternalIcon}
          alt="바로가기"
          size={16}
          className="cursor-pointer"
        />
        <IconImg
          src={TrashIcon}
          alt="삭제"
          size={16}
          className="cursor-pointer hover:text-red-600"
          onClick={() => setDeleteModalOpen(true)}
        />
      </div>
      {/* 섹션 삭제 모달 */}
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => {
          onDelete();
          setDeleteModalOpen(false);
        }}
      />
    </>
  );
};

/** 섹션 컴포넌트 (커리큘럼 전용) */
const WeekSection: React.FC<WeekSectionProps> = ({
  displayNo,
  classId,
  homeworkId,
  title,
  description,
  start_date,
  end_date,
  isOpen,
  onToggle,
  onDelete,
}) => {
  const qc = useQueryClient();
  const { data: lectureInfo } = useGetLecture(classId);

  const { data: hwData, isLoading: hwLoading } = useGetHomework(
    classId,
    homeworkId,
    { enabled: isOpen }
  );
  const visibleProblems = hwData?.problems;
  const problemIds = visibleProblems?.map((prob) => prob.problem_id);

  const lectureLanguageIds = React.useMemo(() => {
    const fromLecture = (lectureInfo?.lecture_language ?? []).filter((id): id is number =>
      Number.isFinite(id)
    );
    const fromLanguageDetail = mapLanguagesNum(
      (lectureInfo?.language ?? [])
        .map((lang) => toLanguageFromName(lang.language_name))
        .filter((v): v is Language => !!v)
    );
    return fromLanguageDetail.length > 0
      ? fromLanguageDetail
      : fromLecture;
  }, [lectureInfo]);

  const defaultLanguageIds = React.useMemo(() => {
    if (lectureLanguageIds.length > 0) return lectureLanguageIds;
    return mapLanguagesNum([
      LANGUAGES.C,
      LANGUAGES.CPP,
      LANGUAGES.PYTHON,
      LANGUAGES.JAVA,
    ]);
  }, [lectureLanguageIds]);

  const getProblemLanguages = (problem: HomeworkProblem) => {
    const raw = problem.language;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return defaultLanguageIds;
  };

  const getProblemPayload = (
    problem: HomeworkProblem,
    startDate: string,
    endDate: string,
    points?: number
  ): SectionProblemPayload | null => {
    if (!problem.problem_id) {
      return null;
    }

    const payload: SectionProblemPayload = {
      problem_uuid: problem.problem_id,
      language: getProblemLanguages(problem),
      start_date: startDate,
      end_date: endDate,
    };

    if (typeof points === "number") {
      payload.points = points;
    }

    const sectionProblemId = (problem.id ?? "").trim();
    if (sectionProblemId && !isTempId(sectionProblemId)) {
      return { ...payload, uuid: sectionProblemId };
    }
    return payload;
  };

  const buildSectionProblemPayloads = (
    items: HomeworkProblem[],
    startDate: string,
    endDate: string,
    defaultPoints?: number
  ): SectionProblemPayload[] => {
    const result: SectionProblemPayload[] = [];
    for (const p of items) {
      const payload = getProblemPayload(p, startDate, endDate, defaultPoints);
      if (!payload) continue;

      result.push(payload);
    }
    return result;
  };

  const mapProblemToPayload = (
    problem: HomeworkProblem,
    startDate: string,
    endDate: string,
    points?: number
  ): SectionProblemPayload | null => {
    return getProblemPayload(problem, startDate, endDate, points);
  };

  //update API 선언
  const updateHomework = useUpdateHomework(classId, homeworkId);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const now = new Date();
  const startIso = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"

  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일 후
  const endIso = end.toISOString().slice(0, 16);

  const [bulkStart, setBulkStart] = useState(start_date?.slice(0, 16) || startIso);
  const [bulkEnd, setBulkEnd] = useState(end_date?.slice(0, 16) || endIso);

  React.useEffect(() => {
    if (start_date) setBulkStart(start_date.slice(0, 16));
    if (end_date) setBulkEnd(end_date.slice(0, 16));
  }, [end_date, start_date]);

  // 전체 과제 날짜 변경
  const applyBulkDateRange = () => {
    const probs = visibleProblems ?? [];
    if (!probs.length) return;
    const validation = validateDateTimeRange(bulkStart, bulkEnd);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }
    const problemsPayload: SectionProblemPayload[] = buildSectionProblemPayloads(
      probs,
      bulkStart,
      bulkEnd
    );
    const toastID = toast.info("저장 중입니다...");
    updateHomework.mutate(
      {
        id: homeworkId,
        title: title,
        problems: problemsPayload,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["homework", classId, homeworkId], exact: true });
          toast.success("저장되었습니다!");
        },
        onError: () => {
          toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        },
        onSettled: () => toast.dismiss(toastID)
      }
    );
  };

  // 문제 1개를 업데이트하고, 항상 '전체 목록'을 payload로 보내는 콜백
  const onProblemChange = (
    id: string,
    updater: (prev: HomeworkProblem) => HomeworkProblem
  ) => {
    const src = visibleProblems ?? [];
    if (src.length === 0) return;

    // 변경 대상만 updater로 갱신
    const next = src.map((p) => (p.id === id ? updater(p) : p));

    const toastID = toast.info("저장 중입니다...");

    // 전체 목록 payload 구성
    const payload = {
      id: homeworkId,
      title,
      problems: next.reduce<SectionProblemPayload[]>((acc, p) => {
        const nextPayload = mapProblemToPayload(p, p.startAt, p.endAt);
        if (nextPayload) acc.push(nextPayload);
        return acc;
      }, []),
    };

    // API 호출 + 해당 과제 쿼리만 무효화하여 refetch
    updateHomework.mutate(payload, {
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: ["homework", classId, homeworkId],
          exact: true,
        });
        toast.success("저장되었습니다!");
      },
      onError: () => {
        toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      },
      onSettled: () => toast.dismiss(toastID)
    });
  };

  // 문제 1개 삭제 payload 생성 및 api 호출
  const onProblemDelete = (id: string) => {
    const key = ["homework", classId, homeworkId] as const;

    // 1) 현재 캐시 스냅샷
    const prev = qc.getQueryData<any>(key);
    const prevList: HomeworkProblem[] = prev?.problems ?? [];

    // 2) 화면에서 먼저 숨김 (캐시 수정)
    const nextList = prevList.filter((p) => p.id === id ? false : true);
    qc.setQueryData(key, { ...prev, problems: nextList });

    const toastID = toast.info("삭제 중입니다...");
    
    // 3) 서버에 전체 payload 전송
    updateHomework.mutate(
      {
        id: homeworkId,
        title,
        problems: nextList.reduce<SectionProblemPayload[]>((acc, p) => {
          const nextPayload = mapProblemToPayload(p, p.startAt, p.endAt);
          if (nextPayload) acc.push(nextPayload);
          return acc;
        }, []),
      },
      {
        onSuccess: () => toast.success("삭제되었습니다!"),
        // 실패하면 롤백
        onError: () => {
          qc.setQueryData(key, prev);
          toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        },
        // 최종 동기화
        onSettled: () => {
          toast.dismiss(toastID);
          qc.invalidateQueries({ queryKey: key, exact: true });
        },
      }
    );
  };

  // 문제 추가 API 호출
  const onImportQuestions = (qs: Question[]) => {
    const key = ["homework", classId, homeworkId] as const;
    const validation = validateDateTimeRange(bulkStart, bulkEnd);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    const toastID = toast.info("저장 중입니다...");

    // 스냅샷 & 현재 목록
    const snapshot = qc.getQueryData<any>(key) ?? {};
    const curr: HomeworkProblem[] = snapshot.problems ?? [];

    // 기존 항목 빠른 조회 (problem_id는 not-null, 그대로 사용)
    const byPid = new Map<string, HomeworkProblem>(
      curr.map((p) => [p.problem_id as string, p])
    );

    // 모달 선택 순서대로 최종 목록(기존 재사용)
    const next: HomeworkProblem[] = (qs ?? []).map((q, idx) => {
      const reused = byPid.get(q.id);
      if (reused) {
        return {
          ...reused,
          // problem_id는 건드리지 않음
          startAt: reused.startAt ?? bulkStart,
          endAt:   reused.endAt   ?? bulkEnd,
          points:  typeof reused.points === "number" ? reused.points : 100,
        };
      }
      // 신규 항목 (임시 음수 id)
      return {
        id: `temp-${Date.now()}-${idx}`,
        title: q.title,
        points: 100,
        problem_id: q.id,
        startAt: bulkStart,
        endAt:   bulkEnd,
        isExam: false,
        language: defaultLanguageIds,
      };
    });

    // 낙관적 캐시 반영
    qc.setQueryData(key, { ...snapshot, problems: next });

    // 서버 payload (id는 기존 양수만 포함, points 포함, problem_id는 그대로)
    const problemsPayload = next
      .reduce<SectionProblemPayload[]>((acc, p) => {
        const payload = mapProblemToPayload(
          p,
          p.startAt ?? bulkStart,
          p.endAt ?? bulkEnd,
          typeof p.points === "number" ? p.points : 100
        );
        if (payload) acc.push(payload);
        return acc;
      }, []);

    updateHomework.mutate(
      { id: homeworkId, title, problems: problemsPayload},
      {
        onSuccess: () => toast.success("저장되었습니다!"),
        onError:   () => {
          qc.setQueryData(key, snapshot);
          toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        },
        onSettled: () =>{
          qc.invalidateQueries({ queryKey: key, exact: true });
          toast.dismiss(toastID);
        }
      }
    );
  };




  return (
    <>
      <div className="mb-2 overflow-hidden border-b border-t border-b-gray-300 border-t-gray-300 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.08)]">
        {/* 섹션 헤더 */}
        <div
          className={`flex cursor-pointer items-center px-5 py-3 ${
            isOpen
              ? "bg-indigo-200 border-gray-400"
              : "bg-white border-gray-300 hover:bg-gray-50"
          }`}
          onClick={onToggle}
        >
          <IconImg src={isOpen ? DownIcon : UpIcon} alt="토글" size={16} />
          <span className="ml-4 w-12 text-center font-kr text-sm">
            {String(displayNo).padStart(2, "0")}
          </span>
          <span className="font-kr flex flex-1 items-center text-sm">
            {title}
          </span>

          {/* 오른쪽 아이콘 */}
          <div
            className="flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <IconImg src={ExternalIcon} alt="바로가기" size={16} />
            <IconImg
              src={TrashIcon}
              alt="삭제"
              size={16}
              className="cursor-pointer hover:text-red-600"
              onClick={() => setDeleteModalOpen(true)}
            />
          </div>
        </div>

        {/* 섹션 바디 */}
        {isOpen && (
          <div className="px-10 py-4 border-t border-gray-200 bg-white">
            {description && (
              <p className="mb-2 font-kr text-xs font-medium text-gray-500">
                {description}
              </p>
            )}

            {/* 기간 일괄 설정 */}
            <div className="mb-4 flex items-center gap-2">
              <span className="font-kr text-xs text-gray-600">
                기간 일괄 설정:
              </span>
              <input
                type="datetime-local"
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                className="h-7 rounded border border-gray-200 px-2 text-[11px]"
              />
              <span className="text-gray-500">~</span>
              <input
                type="datetime-local"
                value={bulkEnd}
                onChange={(e) => setBulkEnd(e.target.value)}
                className="h-7 rounded border border-gray-200 px-2 text-[11px]"
              />
              <Btn
                text="일괄 적용"
                onClick={applyBulkDateRange}
                textSize="text-xs"
                height="h-6"
                width="w-15"
              />
            </div>

            {/* 문제 목록 */}
            <div className="border border-gray-200">
              {hwLoading ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  로딩 중입니다...
                </div>
              ) : visibleProblems && visibleProblems.length > 0 ? (
                visibleProblems.map((p) => (
                  <ProblemRow
                    key={p.id}
                    problem={p}
                    onUpdate={(fn) => onProblemChange(p.id, (prev) => fn(prev))}
                    onDelete={() => onProblemDelete(p.id)}
                  />
                ))
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  선택된 문제가 없습니다. 우측 버튼으로 문제를 가져오세요.
                </div>
              )}
            </div>

            <div className="mt-4 ml-auto flex items-center justify-end gap-2">
              <IconButton
                label="문제 편집하기"
                onClick={() => setImportModalOpen(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* 섹션 삭제 모달 */}
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => {
          onDelete();
          setDeleteModalOpen(false);
        }}
      />

      {/* 문제 가져오기 모달 */}
      <ProblemImportModal
        open={importModalOpen}
        initialSelected = {problemIds ?? []}
        onClose={() => setImportModalOpen(false)}
        onConfirm={(sel) => {
          onImportQuestions(sel);
          setImportModalOpen(false);
        }}
      />
    </>
  );
};

export default WeekSection;
