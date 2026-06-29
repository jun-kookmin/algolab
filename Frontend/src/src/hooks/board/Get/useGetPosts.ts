// src/hooks/community/useGetPosts.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export interface PostUser {
    id?: number;
    username: string;
}

export interface PostItem {
    id: string;
    uuid: string;
    board_uuid: string;
    title: string;
    content?: string;
    user: PostUser;
    user_id?: number;
    created_date: string;
    updated_date?: string;
    problem_uuid: string | null;
    problem_name: string;
    is_noticed?: boolean;
    is_exam_notice?: boolean;
    can_edit: boolean;
    can_open_submission?: boolean;
}

export interface PostListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    data: PostItem[];
    total: number;
}

export interface PostsParams {
    class_id?: string;
    class_uuid?: string;
    is_noticed?: boolean;
    page?: number;
    size?: number;
    problem_id?: string;
    problem_uuid?: string;

    // + 추가
    title?: string;   // ?title=
    author?: string;  // ?author=
    search?: string;  // ?search=
}

/** fetcher */
export const fetchPosts = async (
    params: PostsParams = {}
): Promise<PostListResponse> => {
    const { data } = await BaseApi.get<PostListResponse>(
        "/instructor/posts/",
        {
            params: {
                ...params,
                class_uuid: params.class_uuid ?? params.class_id,
                problem_uuid: params.problem_uuid ?? params.problem_id,
            },
        }
    );
    // console.log("board", data);
    return {
        ...data,
        data: (data.data ?? []).map((p: any) => ({
            ...p,
            uuid: String(p.uuid ?? p.id ?? ""),
            id: String(p.uuid ?? p.id ?? ""),
            board_uuid: String(p.board_uuid ?? p.board ?? ""),
            user_id:
                typeof p.user_id === "number"
                    ? p.user_id
                    : typeof p.user?.id === "number"
                      ? p.user.id
                      : undefined,
            problem_uuid: p.problem_uuid ?? p.problem_id ?? null,
            updated_date: p.updated_date,
            is_exam_notice: Boolean(p.is_exam_notice),
            is_noticed: Boolean(p.is_noticed),
            can_open_submission: Boolean(p.can_open_submission),
        })),
    };
};

/** 커스텀 훅 */
export const useGetPosts = (
    params?: PostsParams,
    options?: Omit<
        UseQueryOptions<PostListResponse, Error, PostListResponse>,
        "queryKey" | "queryFn"
    >
) => {
    return useQuery({
        queryKey: ["posts", params],
        queryFn: () => fetchPosts(params ?? {}),
        ...options,
    });
};
