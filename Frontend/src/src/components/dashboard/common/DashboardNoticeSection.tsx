"use client";

import Link from "next/link";
import React, { useMemo } from "react";

import { PostItem, useGetPosts } from "@/hooks/board/Get/useGetPosts";

const MAX_VISIBLE_NOTICES = 2;
const NOTICE_FETCH_SIZE = 8;
const EXAM_NOTICE_TAG_RE = /^\[시험공지:([0-9a-f-]{36})\]\s*/i;

const formatNoticeDate = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};

const stripNoticePrefix = (title?: string | null): string => {
  return ((title ?? "").replace(EXAM_NOTICE_TAG_RE, "") || "공지사항").trim();
};

type DashboardNoticeSectionProps = {
  className?: string;
};

export default function DashboardNoticeSection({
  className = "",
}: DashboardNoticeSectionProps) {
  const { data, isLoading, error } = useGetPosts(
    {
      is_noticed: true,
      page: 1,
      size: NOTICE_FETCH_SIZE,
    },
    {
      staleTime: 300_000,
      refetchOnWindowFocus: false,
    }
  );

  const notices = useMemo<PostItem[]>(() => {
    const list = Array.isArray(data?.data) ? data.data : [];
    return list
      .filter(
        (item) =>
          !item.is_exam_notice &&
          !EXAM_NOTICE_TAG_RE.test((item.title ?? "").trim())
      )
      .slice(0, MAX_VISIBLE_NOTICES);
  }, [data?.data]);

  return (
    <section className={`w-full max-w-full md:max-w-[336px] ${className}`.trim()}>
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,#fffdf4_0%,#fff8e7_100%)] px-4 py-3 shadow-[0_8px_20px_rgba(148,111,31,0.08)]">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">
            공지
          </span>
          <h2 className="text-base font-bold text-gray-900">공지사항</h2>
        </div>

        <div className="grid gap-2">
          {isLoading ? (
            Array.from({ length: MAX_VISIBLE_NOTICES }).map((_, index) => (
              <div
                key={index}
                className="h-11 rounded-xl bg-white/80 animate-pulse"
              />
            ))
          ) : error ? (
            <div className="rounded-xl bg-white/80 px-3.5 py-3 text-sm text-red-600">
              공지사항을 불러오지 못했습니다.
            </div>
          ) : notices.length === 0 ? (
            <div className="rounded-xl bg-white/80 px-3.5 py-3 text-sm text-gray-500">
              표시할 공지사항이 없습니다.
            </div>
          ) : (
            notices.map((notice) => (
              <Link
                key={notice.uuid}
                href={`/community/posts/${notice.uuid}?from=all`}
                className="block w-full min-w-0 rounded-xl bg-white/85 px-3.5 py-3 transition-colors hover:bg-white"
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                    {stripNoticePrefix(notice.title)}
                  </p>
                  {notice.created_date ? (
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatNoticeDate(notice.created_date)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
