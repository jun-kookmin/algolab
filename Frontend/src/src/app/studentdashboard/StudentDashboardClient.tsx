"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import StudentCurriculumCard from "@/components/dashboard/student/StudentCurriculumCard";
import Pagination from "@/components/dashboard/student/Pagination";
import { coerceBoolean } from "@/utils/boolean";
import {
  LectureSummary,
  GetLecturesResponse,
  useGetLectures,
} from "@/hooks/lectures/Get/useGetLectures";
import HistorySection from "@/components/dashboard/student/HistorySection";
import DashboardNoticeSection from "@/components/dashboard/common/DashboardNoticeSection";

const TABS = [
  { key: "current", label: "이번학기" },
  { key: "past", label: "지난학기" },
  { key: "all", label: "전체" },
  { key: "history", label: "제출기록" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 8;

type Card = {
  id: string;
  title: string;
  partCnt: number;
  problemCnt: number;
  term: string;
  endDate?: string;
  curriculumLocked?: boolean;
};

function getCurrentTerm(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 2 && m <= 7 ? `${y}-1` : `${y}-2`;
}

function termToKey(term: string): number {
  const [yStr, hStr] = term.split("-");
  return (Number(yStr) || 0) * 10 + (Number(hStr) || 0);
}

const parseEndDate = (value?: string): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
};

function deriveTermFromDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 2 && m <= 7 ? `${y}-1` : `${y}-2`;
}

const Inner: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className = "",
}) => (
  <div className={`fluid-container ${className}`}>{children}</div>
);

export default function StudentDashboardClient({
  initialData,
}: {
  initialData?: GetLecturesResponse;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams?.get("tab");
  const pageParam = searchParams?.get("page");
  const isValidTab = (value: string | null): value is TabKey =>
    !!value && TABS.some((t) => t.key === value);

  const [tab, setTab] = useState<TabKey>(
    isValidTab(tabParam) ? tabParam : "current"
  );
  const [page, setPage] = useState(() => {
    const parsed = Number(pageParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });

  useEffect(() => {
    if (isValidTab(tabParam)) {
      setTab((prev) => (prev === tabParam ? prev : tabParam));
      return;
    }
    setTab((prev) => (prev === "current" ? prev : "current"));
  }, [tabParam]);

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

  const { data: lecturesData, isLoading } = useGetLectures(
    {
      page,
      size: PAGE_SIZE,
    },
    {
      initialData,
      staleTime: 300_000,
      refetchOnWindowFocus: false,
      placeholderData: (prev) => prev,
    }
  );

  const lecturesArr = useMemo(() => {
    const arr = (lecturesData as any)?.data ?? (lecturesData as any)?.lectures;
    return Array.isArray(arr) ? arr : [];
  }, [lecturesData]);

  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    if (lecturesArr.length === 0) return;

    const base = lecturesArr.map((lec: LectureSummary) => ({
      id: lec.id,
      title: lec.name ?? "",
      partCnt: lec.section_count,
      problemCnt: lec.problem_count,
      term: deriveTermFromDate(lec.start_date),
      endDate: lec.end_date ?? "",
      curriculumLocked: coerceBoolean(lec.curriculum_locked),
    }));
    setCards(base);
  }, [lecturesArr]);

  const currentTerm = useMemo(() => getCurrentTerm(), []);
  const currentKey = useMemo(() => termToKey(currentTerm), [currentTerm]);
  const isHistory = useMemo(() => tab === "history", [tab]);

  const filtered = useMemo(() => {
    const now = new Date();
    if (tab === "current") {
      return cards.filter((c) => {
        const endDate = parseEndDate(c.endDate);
        if (endDate) return endDate >= now;
        return c.term === currentTerm;
      });
    }
    if (tab === "past") {
      return cards
        .filter((c) => {
          const endDate = parseEndDate(c.endDate);
          if (endDate) return endDate < now;
          return termToKey(c.term) < currentKey;
        })
        .sort((a, b) => termToKey(b.term) - termToKey(a.term));
    }
    return cards;
  }, [tab, cards, currentTerm, currentKey]);

  const totalPages = useMemo(() => {
    const totalCount = (lecturesData as any)?.total ?? filtered.length;
    const pageSize = (lecturesData as any)?.size ?? PAGE_SIZE;
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [lecturesData, filtered.length]);

  const pageCards = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const isInitialLoading = isLoading && cards.length === 0;

  return (
    <div className="font-kr h-full min-h-0 flex flex-col overflow-hidden">
      <div className="bg-white pt-4 flex flex-col flex-1 overflow-hidden">
        <Inner>
          <div className="py-8 md:grid md:grid-cols-[minmax(0,1fr)_336px] md:items-start md:gap-x-8">
            <div className="min-w-0">
              <h1 className="font-kr fluid-title-lg font-semibold md:whitespace-nowrap">
                수강 중인 커리큘럼
              </h1>

              <div className="mt-8 mb-2 flex flex-wrap gap-6">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      if (t.key === tab) return;
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

            <div className="mt-4 md:mt-0 md:justify-self-end">
              <DashboardNoticeSection />
            </div>
          </div>
        </Inner>

        <div className="w-full bg-[rgba(237,239,254,1)] flex-1 overflow-auto">
          <Inner className="h-full">
            <div className="flex flex-col h-full min-h-full">
              <div className="flex-1 overflow-y-auto pt-6">
                {isHistory ? (
                  <HistorySection pageCards={pageCards} />
                ) : isInitialLoading ? (
                  <div className="flex w-full flex-wrap items-stretch gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[clamp(110px,11vh,128px)] fluid-card-w rounded-xl bg-white shadow animate-pulse"
                      />
                    ))}
                  </div>
                ) : pageCards.length === 0 ? (
                  <div className="p-4 text-gray-500 text-sm">
                    표시할 커리큘럼이 없습니다.
                  </div>
                ) : (
                  <div className="flex w-full flex-wrap items-stretch gap-2">
                    {pageCards.map((c) => (
                      <StudentCurriculumCard
                        key={c.id}
                        title={c.title}
                        partCnt={c.partCnt}
                        problemCnt={c.problemCnt}
                        term={c.term}
                        onView={(selectedTab) => {
                          if (selectedTab === "EXAM") {
                            router.push(`/class/${c.id}?tab=exam`);
                          } else {
                            router.push(`/class/${c.id}`);
                          }
                        }}
                        type={null}
                        curriculumLocked={!!c.curriculumLocked}
                      />
                    ))}
                  </div>
                )}
              </div>
              {!isHistory && (
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
    </div>
  );
}
