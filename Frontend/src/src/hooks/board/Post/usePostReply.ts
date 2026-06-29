// src/hooks/board/post/usePostReply.ts
"use client";

import {
    useMutation,
    UseMutationOptions,
    useQueryClient,
} from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** POST body */
export interface PostReplyPayload {
    reply_content: string;
    parent_uuid?: string | null;
}

/** POST 응답 스펙 */
export interface PostReplyResponse {
    id?: string;
    uuid?: string;
    reply_content: string;
    user_name?: string;
    user_id?: number;
    parent_uuid?: string | null;
    reply_date?: string;
    can_edit?: boolean;
    can_open_submission?: boolean;
}

/** mutation에 전달할 변수 */
export interface PostReplyVariables {
    postUuid: string;          // 어떤 게시글의 댓글인지 (uuid)
    payload: PostReplyPayload; // 댓글 내용
}

/** 실제 API 호출 함수 */
const postReply = async ({
    postUuid,
    payload,
}: PostReplyVariables): Promise<PostReplyResponse> => {
    const { data } = await BaseApi.post<any>(
        `/instructor/posts/${postUuid}/replies/`,
        payload
    );
    const uuid = data?.uuid ?? data?.id;
    return {
        ...data,
        uuid,
        id: uuid ? String(uuid) : data?.id,
        can_open_submission: Boolean(data?.can_open_submission),
    };
};

/** 커스텀 훅 */
export const usePostReply = (
    options?: UseMutationOptions<PostReplyResponse, Error, PostReplyVariables>
) => {
    const queryClient = useQueryClient();

    return useMutation<PostReplyResponse, Error, PostReplyVariables>({
        mutationFn: postReply,
        ...options,
        onSuccess: (data, variables, context) => {
            const { postUuid } = variables;

            // 실제 사용하는 queryKey에 맞춰서 invalidate
            queryClient.invalidateQueries({ queryKey: ["postDetail", postUuid] });
            queryClient.invalidateQueries({ queryKey: ["postReplies", postUuid] });
            queryClient.invalidateQueries({ queryKey: ["posts"] });

            if (options && options.onSuccess) {
                options.onSuccess(data, variables, context);
            }
        },
    });
};
