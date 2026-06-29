// src/hooks/board/Delete/useDeletePost.ts
"use client";

import {
    useMutation,
    UseMutationOptions,
    useQueryClient,
} from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** mutation에 전달할 변수 */
export interface DeletePostVariables {
    postUuid: string; // 어떤 게시글을 삭제할지 (uuid)
}

/** 실제 API 호출 함수 (204 No Content) */
const deletePost = async ({ postUuid }: DeletePostVariables): Promise<void> => {
    await BaseApi.delete(`/instructor/posts/${postUuid}/`);
};

/** 커스텀 훅 */
export const useDeletePost = (
    options?: UseMutationOptions<void, Error, DeletePostVariables>
) => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, DeletePostVariables>({
        mutationFn: deletePost,
        ...options,
        onSuccess: (data, variables, context) => {
            const { postUuid } = variables;

            // 삭제된 게시글 상세/목록 invalidate
            queryClient.invalidateQueries({ queryKey: ["postDetail", postUuid] });
            queryClient.invalidateQueries({ queryKey: ["postReplies", postUuid] });
            queryClient.invalidateQueries({ queryKey: ["posts"] });

            if (options && options.onSuccess) {
                options.onSuccess(data, variables, context);
            }
        },
    });
};
