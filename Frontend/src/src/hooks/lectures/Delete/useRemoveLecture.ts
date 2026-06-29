// src/hooks/lectures/Delete/useRemoveLecture.ts
// 커리큘럼을 삭제하는 커스텀 훅입니다.
// DELETE /instructor/lectures/{uuid}/ 엔드포인트를 호출하고, 성공 시 캐시를 무효화합니다.

"use client";

import { useMutation, useQueryClient, UseMutationOptions } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** 삭제 요청의 응답 타입입니다. 204 No Content를 반환하므로 비어 있습니다. */
export type RemoveLectureResponse = void;

/**
 * 강의 삭제 API 호출 함수입니다.
 * @param lectureUuid 삭제할 강의의 고유 UUID
 */
const removeLecture = async (lectureUuid: string): Promise<RemoveLectureResponse> => {
  // DELETE 요청은 본문 없이 엔드포인트만 호출합니다.
    await BaseApi.delete(`/instructor/lectures/${lectureUuid}/`);
    return undefined;
};

/**
 * 강의 삭제 훅입니다. mutate 함수에 강의 ID를 넘기면 삭제가 진행됩니다.
 * @param options React Query의 useMutation 옵션 객체
 */
export const useRemoveLecture = (
    options?: UseMutationOptions<RemoveLectureResponse, Error, string>
) => {
    const queryClient = useQueryClient();
    return useMutation<RemoveLectureResponse, Error, string>({
        mutationFn: (lectureUuid: string) => removeLecture(lectureUuid),
        onSuccess: (data, variables, context) => {
        // 강의 목록 캐시를 무효화하여 목록을 최신 상태로 만듭니다.
            queryClient.invalidateQueries({ queryKey: ["lectures"] });
            if (options && typeof options.onSuccess === "function") {
                options.onSuccess(data, variables, context);
            }
        },
        onError: (error, variables, context) => {
            if (options && typeof options.onError === "function") {
                options.onError(error, variables, context);
            }
        },
        onMutate: (variables) => {
            if (options && typeof options.onMutate === "function") {
                return options.onMutate(variables);
            }
        },
        onSettled: (data, error, variables, context) => {
            if (options && typeof options.onSettled === "function") {
                options.onSettled(data, error, variables, context);
            }
        },
    });
};
