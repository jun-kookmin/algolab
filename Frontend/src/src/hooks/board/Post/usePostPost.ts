// src/hooks/board/post/usePostPost.ts
"use client";

import {
    useMutation,
    UseMutationOptions,
    useQueryClient,
} from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** POST body */
export interface PostPostPayload {
    board_uuid?: string;
    title: string;
    content: string;
    problem_uuid?: string;
    class_uuid?: string;
    is_noticed?: boolean;
}

/** POST 응답 스펙 (스웨거 기준) */
export interface PostPostResponse {
    id: string;
    uuid: string;
    board_uuid: string;
    title: string;
    content: string;
}

/** 실제 API 호출 함수 */
const postPost = async (
    payload: PostPostPayload
): Promise<PostPostResponse> => {
    try {
        const { data } = await BaseApi.post<any>("/instructor/posts/", {
            ...payload,
            board_uuid: payload.board_uuid,
            problem_uuid: payload.problem_uuid,
            class_uuid: payload.class_uuid,
        });
        const uuid = String(data?.uuid ?? data?.id ?? "");
        return {
            ...data,
            uuid,
            id: uuid,
            board_uuid: String(data?.board_uuid ?? data?.board ?? ""),
        };
    } catch (err: any) {
        // 로그가 안 보일 때를 대비해 여기서 직접 출력
        // console.error("POST /instructor/posts/ failed:", {
            // status: err?.response?.status,
            // data: err?.response?.data,
            // payload,
        // });
        throw err;
    }
};

/** 커스텀 훅 */
export const usePostPost = (
    options?: UseMutationOptions<PostPostResponse, Error, PostPostPayload>
) => {
    const queryClient = useQueryClient();

    return useMutation<PostPostResponse, Error, PostPostPayload>({
        mutationFn: postPost,
        ...options,
        onSuccess: (data, variables, context) => {
            // 목록 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ["posts"] });

            // 외부에서 넘긴 onSuccess도 호출
            if (options && options.onSuccess) {
                options.onSuccess(data, variables, context);
            }
        },
    });
};
