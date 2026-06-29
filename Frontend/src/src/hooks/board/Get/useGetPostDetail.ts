// src/hooks/community/useGetPostDetail.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

/** 댓글 타입 */
export interface PostReply {
    id: string;
    reply_content: string;
    user_name: string;
    user_id?: number;
    parent_uuid?: string | null;
    reply_date: string; // ISO 문자열
    can_edit: boolean;
    can_open_submission?: boolean;
}

/** 게시글 상세 타입 (Swagger 기준) */
export interface PostDetail {
    id: string;
    uuid: string;
    board_uuid: string;
    title: string;
    content: string;
    user_id?: number;
    username: string;
    problem_uuid: string | null;
    problem_name: string | null;
    created_date: string;
    updated_date: string;
    is_noticed?: boolean;
    replies: PostReply[];
    can_edit: boolean;
    can_open_submission?: boolean;
}

/** fetcher */
export const fetchPostDetail = async (
    postUuid: string,
    params?: Record<string, string | number | boolean>
): Promise<PostDetail> => {
    const { data } = await BaseApi.get<any>(`/instructor/posts/${postUuid}/`, {
        params,
    });
    const uuid = String(data?.uuid ?? data?.id ?? "");
    return {
        ...data,
        uuid,
        id: uuid,
        board_uuid: String(data?.board_uuid ?? data?.board ?? ""),
        user_id:
            typeof data?.user_id === "number"
                ? data.user_id
                : undefined,
        problem_uuid: data?.problem_uuid ?? data?.problem_id ?? null,
        is_noticed: Boolean(data?.is_noticed),
        can_open_submission: Boolean(data?.can_open_submission),
        replies: (data?.replies ?? []).map((r: any) => ({
            ...r,
            id: String(r.uuid ?? r.id ?? ""),
            user_id:
                typeof r?.user_id === "number"
                    ? r.user_id
                    : undefined,
            parent_uuid: r?.parent_uuid ?? null,
            can_open_submission: Boolean(r?.can_open_submission),
        })),
    };
};

type PostDetailQueryOptions = Omit<
    UseQueryOptions<PostDetail, Error, PostDetail>,
    "queryKey" | "queryFn"
> & {
    params?: Record<string, string | number | boolean>;
};

/** 커스텀 훅 */
export const useGetPostDetail = (
    postUuid: string | undefined,
    options?: PostDetailQueryOptions
) => {
    const params = options?.params;
    return useQuery({
        queryKey: ["postDetail", postUuid, params],
        queryFn: () => {
            if (postUuid === undefined) {
                // 타입 가드용 (enabled=false면 실행 안 됨)
                return Promise.reject(new Error("post id is undefined"));
            }
            return fetchPostDetail(postUuid, params);
        },
        enabled: (options?.enabled ?? true) && postUuid !== undefined,
        ...options,
    });
};
