// src/hooks/board/put/usePutReply.ts
"use client";

import {
    useMutation,
    UseMutationOptions,
    useQueryClient,
} from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** PUT body */
export interface PutReplyPayload {
    reply_content: string;
}

/** PUT 응답 스펙 */
export interface PutReplyResponse {
    id?: string;
    uuid?: string;
    reply_content: string;
}

/** mutation에 전달할 변수 */
export interface PutReplyVariables {
    postUuid: string;    // 어떤 게시글의 댓글인지 (uuid)
    replyId: string;     // 어떤 댓글인지
    payload: PutReplyPayload;
}

/** 실제 API 호출 함수 */
const putReply = async ({
    postUuid,
    replyId,
    payload,
}: PutReplyVariables): Promise<PutReplyResponse> => {
    const { data } = await BaseApi.put<any>(
        `/instructor/posts/${postUuid}/replies/${replyId}/`,
        payload
    );
    const uuid = data?.uuid ?? data?.id;
    return { ...data, uuid, id: uuid ? String(uuid) : data?.id };
};

/** 커스텀 훅 */
export const usePutReply = (
    options?: UseMutationOptions<PutReplyResponse, Error, PutReplyVariables>
) => {
    const queryClient = useQueryClient();

    return useMutation<PutReplyResponse, Error, PutReplyVariables>({
        mutationFn: putReply,
        ...options,
        onSuccess: (data, variables, context) => {
            const { postUuid } = variables;

            // 댓글 수정 후 상세/댓글 리스트 refetch
            queryClient.invalidateQueries({ queryKey: ["postDetail", postUuid] });
            queryClient.invalidateQueries({ queryKey: ["postReplies", postUuid] });
            queryClient.invalidateQueries({ queryKey: ["posts"] });

            if (options && options.onSuccess) {
                options.onSuccess(data, variables, context);
            }
        },
    });
};
