// src/hooks/board/put/usePutPost.ts
"use client";

import {
    useMutation,
    UseMutationOptions,
    useQueryClient,
} from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** PUT body */
export interface PutPostPayload {
    title: string;
    content: string;
    is_noticed?: boolean;
}

/** PUT 응답 스펙 */
export interface PutPostResponse {
    id: string;
    uuid: string;
    title: string;
    content: string;
}

/** mutation에 전달할 변수 */
export interface PutPostVariables {
    postUuid: string; // 수정할 게시글 uuid
    payload: PutPostPayload;
}

/** 실제 API 호출 함수 */
const putPost = async ({
    postUuid,
    payload,
}: PutPostVariables): Promise<PutPostResponse> => {
    const { data } = await BaseApi.put<any>(
        `/instructor/posts/${postUuid}/`,
        payload
    );
    const uuid = String(data?.uuid ?? data?.id ?? "");
    return {
        ...data,
        uuid,
        id: uuid,
    };
};

/** 커스텀 훅 */
export const usePutPost = (
    options?: UseMutationOptions<PutPostResponse, Error, PutPostVariables>
) => {
    const queryClient = useQueryClient();

    return useMutation<PutPostResponse, Error, PutPostVariables>({
        mutationFn: putPost,
        ...options,
        onSuccess: (data, variables, context) => {
            // 목록 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            // 단일 게시글 캐시가 있다면 같이 무효화
            queryClient.invalidateQueries({
                queryKey: ["postDetail", variables.postUuid],
            });
            queryClient.invalidateQueries({
                queryKey: ["postReplies", variables.postUuid],
            });

            // 외부에서 넣어준 onSuccess도 호출
            if (options && options.onSuccess) {
                options.onSuccess(data, variables, context);
            }
        },
    });
};
