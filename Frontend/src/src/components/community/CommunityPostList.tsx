// components/community/CommunityPostList.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Pagination from "@/components/dashboard/instructor/Pagination";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import {
    PostListResponse,
    useGetPosts,
} from "@/hooks/board/Get/useGetPosts";

export type PostCard = {
    id: string;
    problemId: string | null;
    problemTitle: string;
    title: string;
    author: string;
    authorUserId?: number;
    authorCanOpenSubmission?: boolean;
    createdAt: string;
    updatedAt?: string;
    content?: string;
    isNoticed?: boolean;
};

type CommunityPostListProps = {
    pageSize?: number;
    showSearch?: boolean;
    listTitle?: string;
    problemId?: string;
    origin?: "all" | "problem";
    originProblemId?: string;
    initialData?: PostListResponse;
};

type SearchType = "search" | "title" | "author";

const EXAM_NOTICE_TAG_RE = /^\[시험공지:([0-9a-f-]{36})\]\s*/i;

const isExamNoticePost = (title?: string | null): boolean => {
  return EXAM_NOTICE_TAG_RE.test((title ?? "").trim());
};

const formatPostDateTime = (value?: string | null): string => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
        date.getDate()
    ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes()
    ).padStart(2, "0")}`;
};

export function CommunityPostList({
    pageSize = 16,
    showSearch = false,
    listTitle,
    problemId,
    origin,
    originProblemId,
    initialData,
}: CommunityPostListProps) {
    const SEARCHICON = "/assets/icon/Icon_Search.svg";

    const router = useRouter();
    const { me } = useAuth();
    const prefetchedDetailRoutesRef = useRef<Set<string>>(new Set());
    const [page, setPage] = useState(1);

    // 입력값(타이핑)은 API 호출을 트리거하지 않음
    const [query, setQuery] = useState("");

    // 드롭다운 선택(입력 단계)
    const [searchType, setSearchType] = useState<SearchType>("search");

    // 실제로 API에 적용되는 값(검색 버튼을 눌러야만 바뀜)
    const [appliedQuery, setAppliedQuery] = useState("");
    const [appliedType, setAppliedType] = useState<SearchType>("search");

    const emptyMessage = "질문이 없습니다.";
    const searchPlaceholder = "검색어를 입력하세요";
    const resolvedOriginProblemId = originProblemId ?? problemId;
    const viewerId = typeof me?.pk === "number" ? me.pk : null;

    const buildDetailHref = (postId: string) => {
        if (origin === "all") {
            return `/community/posts/${postId}?from=all`;
        }
        if (origin === "problem" && resolvedOriginProblemId) {
            const params = new URLSearchParams({
                from: "problem",
                problem_id: resolvedOriginProblemId,
            });
            return `/community/posts/${postId}?${params.toString()}`;
        }
        return `/community/posts/${postId}`;
    };

    const canOpenSubmissionPage = (
        targetUserId?: number,
        canOpenSubmission?: boolean
    ) => {
        return Boolean(
            targetUserId != null &&
            viewerId != null &&
            canOpenSubmission
        );
    };

    const buildSubmissionHref = (targetUserId?: number, author?: string) => {
        if (targetUserId == null) return "";
        const params = new URLSearchParams();
        const normalizedAuthor = author?.trim() ?? "";
        if (normalizedAuthor) {
            params.set("name", normalizedAuthor);
        }
        const query = params.toString();
        return query
            ? `/submission/${targetUserId}?${query}`
            : `/submission/${targetUserId}`;
    };

    const prefetchDetailHref = (href: string) => {
        if (prefetchedDetailRoutesRef.current.has(href)) return;
        prefetchedDetailRoutesRef.current.add(href);
        router.prefetch(href);
    };

    const apiParams = useMemo(() => {
        const base: any = {
            page,
            size: pageSize,
            problem_id: problemId,
        };

        if (!showSearch) return base;

        const q = appliedQuery.trim();
        if (!q) return base;

        if (appliedType === "title") base.title = q;
        else if (appliedType === "author") base.author = q;
        else base.search = q;

        return base;
    }, [page, pageSize, problemId, showSearch, appliedQuery, appliedType]);

    const shouldUseInitialData =
        !!initialData &&
        page === 1 &&
        appliedType === "search" &&
        appliedQuery.trim().length === 0;

    const { data, isLoading, isFetching, error } = useGetPosts(apiParams, {
        initialData: shouldUseInitialData ? initialData : undefined,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });

    const loading = isLoading || isFetching;

    const posts: PostCard[] = useMemo(() => {
        if (!data) return [];

        const list =
            (data as any)?.data ??
            (data as any)?.results ??
            [];

        if (!Array.isArray(list)) return [];

        const visibleList = list.filter(
          (item) =>
            !isExamNoticePost(item?.title) &&
            !Boolean(item?.is_exam_notice)
        );

        return visibleList.map((item: any) => ({
            id: String(item.uuid ?? item.id ?? ""),
            problemId: item.problem_uuid ?? item.problem_id ?? null,
            problemTitle: item.problem_name,
            title: item.title,
            author: item.user?.username ?? "",
            authorUserId:
                typeof item.user_id === "number"
                    ? item.user_id
                    : typeof item.user?.id === "number"
                      ? item.user.id
                      : undefined,
            authorCanOpenSubmission: Boolean(item.can_open_submission),
            createdAt: item.created_date,
            updatedAt: item.updated_date,
            content: item.content,
            isNoticed: Boolean(item.is_noticed),
        }));
    }, [data]);

    const totalItems = data?.total ?? data?.count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    const onClickSearch = () => {
        setPage(1);
        setAppliedType(searchType);
        setAppliedQuery(query.trim());
    };

    return (
        <div className="flex-1 overflow-y-auto pb-6">
            {/* 타이틀 + 검색 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                {listTitle && (
                    <h2 className="font-kr text-2xl font-semibold tracking-tight">
                        {listTitle}
                    </h2>
                )}

                {showSearch && (
                    <div className="w-full sm:w-[520px] mt-1">
                        <div className="flex gap-2">
                            {/* 드롭다운 */}
                            <select
                                className="w-[120px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/60"
                                value={searchType}
                                onChange={(e) => setSearchType(e.target.value as SearchType)}
                            >
                                <option value="search">통합</option>
                                <option value="title">제목</option>
                                <option value="author">작성자</option>
                            </select>

                            {/* 입력 */}
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/60 placeholder:text-gray-400"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        onClickSearch();
                                        }
                                    }}
                                    />
                            </div>

                            {/* 검색 버튼 (이 버튼을 눌러야만 검색 적용) */}
                            <button
                                type="button"
                                onClick={onClickSearch}
                                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100"
                            >
                                <Image
                                    src={SEARCHICON}
                                    alt="Search"
                                    width={20}
                                    height={20}
                                    className="w-5 h-5 opacity-80"
                                />
                                검색
                            </button>
                        </div>

                        {/* 현재 적용된 검색 상태(선택) */}
                        {(appliedQuery.trim() && (
                            <div className="mt-2 text-xs text-gray-500">
                                적용된 검색:{" "}
                                {appliedType === "title"
                                    ? "제목"
                                    : appliedType === "author"
                                    ? "작성자"
                                    : "통합"}
                                {" / "}
                                {appliedQuery}
                            </div>
                        )) || null}
                    </div>
                )}
            </div>

            {/* 상태 처리 */}
            {loading ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-gray-500 text-sm">
                    게시글을 불러오는 중입니다...
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center text-red-600 text-sm">
                    게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                </div>
            ) : posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-gray-500 text-sm">
                    {emptyMessage}
                </div>
            ) : (
                <div className="rounded-2xl border border-gray-300 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-sm font-semibold uppercase tracking-[0.08em] text-gray-600 border-b border-gray-300">
                                    <th className="px-5 py-2.5 text-center">제목</th>
                                    <th className="px-5 py-2.5 text-center border-l border-gray-300">문제</th>
                                    <th className="px-5 py-2.5 text-center border-l border-gray-300 w-[90px]">작성자</th>
                                    <th className="px-5 py-2.5 text-center border-l border-gray-300 w-[120px]">일시</th>
                                </tr>
                            </thead>

                            <tbody>
                                {posts.map((post, idx) => {
                                    const effectiveDate =
                                        post.isNoticed && post.updatedAt
                                            ? post.updatedAt
                                            : post.createdAt;
                                    return (
                                    <tr
                                        key={post.id}
                                        className={`text-sm transition-colors border-b border-gray-300 ${
                                            idx % 2 === 1 ? "bg-slate-100" : "bg-white"
                                        } hover:bg-primary/10 cursor-pointer`}
                                        onMouseEnter={() =>
                                            prefetchDetailHref(buildDetailHref(post.id))
                                        }
                                        onFocus={() =>
                                            prefetchDetailHref(buildDetailHref(post.id))
                                        }
                                        onClick={() => router.push(buildDetailHref(post.id))}
                                    >
                                        <td className="px-5 py-2.5 align-middle">
                                            <div className="flex items-center gap-2">
                                                {post.isNoticed && (
                                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                                                        공지
                                                    </span>
                                                )}
                                                <span className="font-kr text-[15px] font-medium text-primary line-clamp-1 hover:text-primary/80 underline-offset-2 hover:underline">
                                                    {post.title}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-5 py-2.5 align-middle border-l border-gray-300">
                                            {post.problemId != null ? (
                                                <button
                                                    type="button"
                                                    className="text-xs sm:text-sm text-gray-700 line-clamp-1 hover:text-primary underline-offset-2 hover:underline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/community/${post.problemId}`);
                                                    }}
                                                >
                                                    {post.problemTitle}
                                                </button>
                                            ) : (
                                                <span className="text-xs sm:text-sm text-gray-500">
                                                    자유 글
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-5 py-2.5 align-middle border-l border-gray-300 text-center text-xs text-gray-700 whitespace-nowrap w-[90px]">
                                            {canOpenSubmissionPage(
                                                post.authorUserId,
                                                post.authorCanOpenSubmission
                                            ) ? (
                                                <button
                                                    type="button"
                                                    className="hover:text-primary hover:underline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(
                                                            buildSubmissionHref(
                                                                post.authorUserId,
                                                                post.author
                                                            )
                                                        );
                                                    }}
                                                >
                                                    {post.author || "-"}
                                                </button>
                                            ) : (
                                                <span>{post.author || "-"}</span>
                                            )}
                                        </td>

                                        <td className="px-5 py-2.5 align-middle border-l border-gray-300 text-right text-xs text-gray-500 whitespace-nowrap w-[120px]">
                                            {formatPostDateTime(effectiveDate)}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {totalPages > 1 && (
                <Pagination
                    page={page}
                    total={totalPages}
                    onChange={setPage}
                    className="mt-4"
                />
            )}
        </div>
    );
}
