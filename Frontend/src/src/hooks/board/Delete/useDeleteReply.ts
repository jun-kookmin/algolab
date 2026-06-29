// ──── FILE: src/hooks/board/Delete/useDeleteReply.ts ────
"use client";

import {
    useMutation,
    UseMutationOptions,
    useQueryClient,
} from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** mutation에 전달할 변수 */
export interface DeleteReplyVariables {
    postUuid: string;   // 게시글 uuid
    replyId: string;  // 댓글 id (id)
}

/** 실제 API 호출 함수 */
const deleteReply = async ({
    postUuid,
    replyId,
}: DeleteReplyVariables): Promise<void> => {
    await BaseApi.delete(
        `/instructor/posts/${postUuid}/replies/${replyId}/`
    );
};

/** 커스텀 훅 */
export const useDeleteReply = (
    options?: UseMutationOptions<void, Error, DeleteReplyVariables>
) => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, DeleteReplyVariables>({
        mutationFn: deleteReply,
        onSuccess: (data, variables, context) => {
            // 댓글 삭제 후 게시글 상세 데이터 다시 불러오기
            queryClient.invalidateQueries({
                queryKey: ["postDetail", variables.postUuid],
            });
            queryClient.invalidateQueries({
                queryKey: ["postReplies", variables.postUuid],
            });
            queryClient.invalidateQueries({ queryKey: ["posts"] });

            // 사용자가 전달한 onSuccess도 실행
            if (options && options.onSuccess) {
                options.onSuccess(data, variables, context);
            }
        },
        ...options,
    });
};
