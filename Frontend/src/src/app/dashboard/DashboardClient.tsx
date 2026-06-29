"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import CurriculumCard from "@/components/dashboard/instructor/CurriculumCard";
import Pagination from "@/components/dashboard/instructor/Pagination";
import AddCurriculumModal from "@/components/dashboard/instructor/AddCurriculumModal";
import DeleteModal from "@/components/class/DeleteModal";
import EditCurriculumModal from "@/components/dashboard/instructor/EditCurriculumModal";
import DashboardNoticeSection from "@/components/dashboard/common/DashboardNoticeSection";

import {
  GetLecturesResponse,
  LectureSummary,
  useGetLectures,
} from "@/hooks/lectures/Get/useGetLectures";
import { useAddLecture } from "@/hooks/lectures/Put/useAddLecture";
import {
  Language,
  toLanguageFromName,
  mapLanguages,
  mapLanguagesNum,
} from "@/types/languages";
import { toast, Id } from "react-toastify";
import { useUpdateLecture } from "@/hooks/lectures/Update/useUpdateLecture";
import { useRemoveLecture } from "@/hooks/lectures/Delete/useRemoveLecture";
import { coerceBoolean } from "@/utils/boolean";

/* ─────────── 상수/더미 데이터 ─────────── */
const TABS = [
  { key: "current", label: "이번학기" },
  { key: "done", label: "관리완료" },
  { key: "all", label: "전체" },
  { key: "exam", label: "시험감독" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 8;

type Card = {
  id: string;
  title: string;
  partCnt: number;
  problemCnt: number;
  term: string;
  startDate?: string;
  endDate?: string;
  languages: Language[];
  curriculumLocked?: boolean;
};

function deriveTermFromDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 2 && m <= 7 ? `${y}-1` : `${y}-2`;
}

const toApiDateTime = (value: string): string => {
  const trimmed = value?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return value;
  }
  return `${trimmed}T00:00:00`;
};

/* ─────────── 레이아웃 래퍼 ─────────── */
const Inner: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className = "",
}) => (
  <div className={`fluid-container ${className}`}>{children}</div>
);

type DashboardClientProps = {
  initialTab?: TabKey;
  initialPage?: number;
  initialLecturesData?: GetLecturesResponse;
};

export default function InstructorDashboardUpdated({
  initialTab = "current",
  initialPage = 1,
  initialLecturesData,
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams?.get("tab");
  const pageParam = searchParams?.get("page");
  const isValidTab = (value: string | null): value is TabKey =>
    !!value && TABS.some((t) => t.key === value);

  const [tab, setTab] = useState<TabKey>(() => {
    if (initialTab) return initialTab;
    if (tabParam === "exam") return "current";
    return isValidTab(tabParam) ? tabParam : "current";
  });
  const [page, setPage] = useState(() => {
    if (initialPage > 0) return initialPage;
    const parsed = Number(pageParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });

  useEffect(() => {
    if (tabParam === "exam") {
      router.replace("/testmanage");
      return;
    }
    if (isValidTab(tabParam)) {
      setTab((prev) => (prev === tabParam ? prev : tabParam));
      return;
    }
    setTab((prev) => (prev === "current" ? prev : "current"));
  }, [tabParam, router]);

  useEffect(() => {
    const parsed = Number(pageParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      setPage((prev) => (prev === parsed ? prev : parsed));
      return;
    }
    setPage((prev) => (prev === 1 ? prev : 1));
  }, [pageParam]);

  const updateQuery = useCallback(
    (nextTab: TabKey, nextPage: number) => {
      if (!pathname) return;
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", nextTab);
      params.set("page", String(nextPage));
      const next = params.toString();
      const current = searchParams?.toString() ?? "";
      if (next !== current) {
        router.replace(`${pathname}?${next}`);
      }
    },
    [pathname, router, searchParams]
  );
  const [cards, setCards] = useState<Card[]>([]);

  const toLanguageIds = useCallback((langs: Language[]) => {
    const ids = mapLanguagesNum(langs);
    return Array.from(new Set(ids));
  }, []);

  /* 모달 상태 */
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const status = useMemo(() => {
    if (tab === "current") return "current";
    if (tab === "done") return "done";
    return "all";
  }, [tab]);

  // 탭/페이지별 강의 목록 로딩
  const {
    data: lecturesData,
    isLoading,
    error,
  } = useGetLectures({
    page,
    size: PAGE_SIZE,
    status,
  }, {
    initialData:
      tab === initialTab && page === initialPage
        ? initialLecturesData
        : undefined,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // 각 lecture의 세부 정보 로딩 & 설정
  const lecturesArr = useMemo(() => {
    const arr = (lecturesData as any)?.data;
    return Array.isArray(arr) ? arr : [];
  }, [lecturesData]);

  // lecture의 정보 -> card 형태로 변환
  useEffect(() => {
    // 1) 먼저 0으로 채운 카드로 즉시 렌더
    const base = lecturesArr.map((lec: LectureSummary) => {
      const fromNames = (lec.language ?? [])
        .map((l) => toLanguageFromName(l.language_name))
        .filter((v): v is Language => !!v);
      const fallback =
        mapLanguages(Array.isArray(lec.lecture_language) ? lec.lecture_language : []);
      return {
        id: lec.id,
        title: lec.name ?? "",
        partCnt: lec.section_count,
        problemCnt: lec.problem_count,
        term: deriveTermFromDate(lec.start_date),
        startDate: lec.start_date ?? "",
        endDate: lec.end_date ?? "",
        curriculumLocked: coerceBoolean(lec.curriculum_locked),
        languages:
          fromNames.length > 0
            ? fromNames
            : fallback,
      };
    });
    setCards(base);
  }, [lecturesArr]);

  const filteredCards = cards;

  const totalPages = useMemo(() => {
    const total = (lecturesData as any)?.total ?? filteredCards.length;
    const size = (lecturesData as any)?.size ?? PAGE_SIZE;
    return total > 0 ? Math.ceil(total / size) : 0;
  }, [lecturesData, filteredCards.length]);

  useEffect(() => {
    if (totalPages === 0) return;
    if (page > totalPages) {
      setPage(totalPages);
      updateQuery(tab, totalPages);
    }
  }, [page, totalPages, tab, updateQuery]);

  const pagedCards = useMemo(() => {
    if (!filteredCards.length) return [];
    return filteredCards;
  }, [filteredCards]);

  const toastRef = useRef<Id | null>(null);

  // 커리큘럼 추가 API
  const { mutate: addLecture } = useAddLecture({
    onMutate: () => {
      toastRef.current = toast.info("커리큘럼 추가 중입니다...");
      setModalOpen(false);
    },
    onSuccess: () => {
      const nextPage = 1;
      setPage(nextPage);
      updateQuery(tab, nextPage);
      toast.success("커리큘럼이 추가되었습니다!");
    },
    onError: () => {
      toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      // console.error(err);
    },
    onSettled: () => {
      if (toastRef.current) toast.dismiss(toastRef.current);
      toastRef.current = null;
    },
  });

  // 커리큘럼 제작 시 시작할 함수
  const handleCreateCurriculum = (
    className: string,
    startDate: string,
    endDate: string,
    languages: Language[]
  ) => {
    const lecture_language = toLanguageIds(languages);
    if (lecture_language.length === 0) {
      toast.error("언어 정보를 불러오지 못해 커리큘럼을 생성할 수 없습니다.");
      return;
    }
    addLecture({
      lecture_language,
      name: className,
      start_date: toApiDateTime(startDate),
      end_date: toApiDateTime(endDate),
    });
  };

  // 수정 버튼 클릭 시 실행할 함수
  const handleEditClick = (card: Card) => {
    setEditingCard(card);
    setEditModalOpen(true);
  };

  // 수정 API 훅 호출 (토스트 옵션 포함)
  const { mutate: submitLectureUpdate } = useUpdateLecture({
    onMutate: () => {
      toastRef.current = toast.info("커리큘럼 수정 중입니다...");
    },
    onSuccess: () => {
      toast.success("커리큘럼이 수정되었습니다!");
    },
    onError: () => {
      toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      // console.error(err);
    },
    onSettled: () => {
      if (toastRef.current) toast.dismiss(toastRef.current);
      toastRef.current = null;
    },
  });

  // 수정 확정 시 호출되는 함수
  const handleUpdateCurriculum = (
    className: string,
    startDate: string,
    endDate: string,
    languages: Language[],
    curriculumLocked: boolean
  ): void => {
    if (!editingCard) return;
    const lecture_language = toLanguageIds(languages);
    if (lecture_language.length === 0) {
      toast.error("언어 정보를 불러오지 못해 수정할 수 없습니다.");
      return;
    }
    // UI 즉시 업데이트
    setCards((prev) =>
      prev.map((c) =>
        c.id === editingCard.id
          ? {
              ...c,
              title: className,
              term: deriveTermFromDate(startDate),
              startDate,
              endDate,
              languages,
              curriculumLocked,
            }
          : c
      )
    );
    setEditModalOpen(false);
    // mutate 호출 시 id를 함께 넘김
    submitLectureUpdate({
      lecture_uuid: editingCard.id,
      lecture_language,
      name: className,
      start_date: toApiDateTime(startDate),
      end_date: toApiDateTime(endDate),
      curriculum_locked: curriculumLocked,
    });
    // 호출 이후에 editingCard 초기화
    setEditingCard(null);
  };

  const { mutate: removeLecture } = useRemoveLecture({
    onMutate: () => {
      toastRef.current = toast.info("커리큘럼 삭제 중입니다...");
    },
    onSuccess: () => {
      toast.success("커리큘럼이 삭제되었습니다!");
    },
    onError: () => {
      toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      // console.error(err);
    },
    onSettled: () => {
      if (toastRef.current) toast.dismiss(toastRef.current);
      toastRef.current = null;
    },
  });

  /* 삭제 */
  const handleDeleteClick = (id: string) => {
    setTargetId(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (targetId == null) return;
    // 프론트 상태를 즉시 갱신하여 UI 반영
    setCards((prev) => prev.filter((c) => c.id !== targetId));
    // 백엔드 삭제 호출
    removeLecture(targetId);
    // 모달 닫기 및 상태 초기화
    setDeleteModalOpen(false);
    setTargetId(null);
  };

  /* ─────────── 탭별 콘텐츠 (시험감독 제외) ─────────── */
  const renderNonExamContent = () => {
    if (isLoading) {
      return (
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 w-full rounded-xl bg-white shadow animate-pulse"
            />
          ))}
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-4 text-red-600 text-sm whitespace-pre-wrap">
          불러오기 실패: {error.message}
        </div>
      );
    }
    // 표시할 카드가 없으면 안내 문구 표시
    if (filteredCards.length === 0) {
      const message =
        tab === "done"
          ? "아직 ‘관리 완료’ 커리큘럼이 없습니다."
          : "표시할 커리큘럼이 없습니다.";
      return <div className="p-4 text-gray-500 text-sm">{message}</div>;
    }
    // 카드 목록 렌더링
    return (
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pagedCards.map((c) => (
          <CurriculumCard
            key={c.id}
            {...c}
            onEdit={() => handleEditClick(c)}
            onDelete={() => handleDeleteClick(c.id)}
            onManage={() => router.push(`/class/${c.id}/classmanage/`)}
            onView={() => router.push(`/class/${c.id}/edit`)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* mx-12는 항상 유지 */}
      <div className="bg-white pt-4 flex flex-col flex-1 overflow-hidden">
        {/* 상단 툴바 & 탭 버튼 */}
        <Inner>
          {/* 툴바 */}
          <div className="py-8 md:grid md:grid-cols-[minmax(0,1fr)_336px] md:items-start md:gap-x-8">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h1 className="font-kr fluid-title-lg font-semibold md:whitespace-nowrap">
                  관리 중인 커리큘럼
                </h1>
                <button
                  onClick={() => setModalOpen(true)}
                  className="font-kr rounded-[10px] border border-indigo-300 bg-white px-4 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 active:scale-95 md:hidden"
                >
                  커리큘럼 추가
                </button>
              </div>

              <div className="mt-8 mb-2 flex flex-wrap gap-6">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      if (t.key === tab) return;
                      if (t.key === "exam") {
                        router.push("/testmanage");
                        return;
                      }
                      const nextPage = 1;
                      setTab(t.key);
                      setPage(nextPage);
                      updateQuery(t.key, nextPage);
                    }}
                    className={`font-kr pb-1 font-semibold ${
                      tab === t.key
                        ? "border-b-2 border-primary text-primary"
                        : "text-gray-600 hover:text-primary"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:mt-0 md:justify-self-end">
              <button
                onClick={() => setModalOpen(true)}
                className="font-kr hidden self-end rounded-[10px] border border-indigo-300 bg-white px-5 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 active:scale-95 md:inline-flex"
              >
                커리큘럼 추가
              </button>
              <DashboardNoticeSection />
            </div>
          </div>
        </Inner>
        {/* ─────────── 탭 영역 ─────────── */}
        <div className="w-full bg-[rgba(237,239,254,1)] flex-1 overflow-auto">
          <Inner className="h-full">
            <div className="flex flex-col h-full min-h-full">
                <div className="flex-1 overflow-y-auto pt-6">
                {renderNonExamContent()}
              </div>
              {/* 
               * 페이지가 하나 이상 있을 때만 Pagination 컴포넌트를 렌더링합니다.
               * totalPages가 0이면 강의가 없다는 의미이므로 페이지네이션을 숨깁니다.
               */}
              {totalPages > 0 && (
                  <div className="mt-auto pb-6">
                  <Pagination
                    page={page}
                    total={totalPages}
                    onChange={(nextPage) => {
                      if (nextPage === page) return;
                      setPage(nextPage);
                      updateQuery(tab, nextPage);
                    }}
                    className="pt-2"
                  />
                </div>
              )}
            </div>
          </Inner>
        </div>
      </div>
      {/* 모달들 */}
      <AddCurriculumModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateCurriculum}
      />
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
      {editingCard && (
        <EditCurriculumModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingCard(null);
          }}
          initialClassName={editingCard.title}
          initialStartDate={editingCard.startDate ?? ""}
          initialEndDate={editingCard.endDate ?? ""}
          initialLanguages={editingCard.languages ?? []}
          initialCurriculumLocked={!!editingCard.curriculumLocked}
          onUpdate={handleUpdateCurriculum}
        />
      )}
    </div>
  );
}
