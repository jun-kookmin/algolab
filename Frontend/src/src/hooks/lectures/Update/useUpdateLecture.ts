// 예: src/hooks/lectures/Put/useUpdateLecture.ts

import { useMutation, UseMutationOptions, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/** 강의 수정 요청 데이터 구조 */
export interface UpdateLectureRequest {
    lecture_language: number[];
    name: string;
    description?: string;
    weeks?: number;
    start_date?: string;
    end_date?: string;
    is_delete?: boolean;
    curriculum_locked?: boolean;
}

/** 강의 수정 응답 형식 */
export interface UpdateLectureResponse {
    success?: boolean;
}

/** mutation 호출 시 사용할 변수: 강의 id가 포함됨 */
export interface UpdateLectureVariables extends UpdateLectureRequest {
    lecture_uuid: string;
}

/** 실제 API 호출 함수는 그대로 유지합니다 */
const updateLecture = async (
    lectureUuid: string,
    payload: UpdateLectureRequest
): Promise<UpdateLectureResponse> => {
    try {
        const { data } = await BaseApi.patch<UpdateLectureResponse>(
            `/instructor/lectures/${lectureUuid}/`,
            payload
        );
        return data;
    } catch (err: any) {
        if (err.response) {
            // console.error("[useUpdateLecture] status:", err.response.status);
            // console.error("[useUpdateLecture] data:", err.response.data);
            // console.error("[useUpdateLecture] url:", err.config?.url);
            // console.error("[useUpdateLecture] method:", err.config?.method);
        } else {
            // console.error("[useUpdateLecture] error:", err);
        }
        throw err;
    }
};

/**
 * 강의 수정 훅
 * mutate 호출 시 { id, ...payload } 형태로 값을 넘겨야 합니다.
 */
export const useUpdateLecture = (
  options?: UseMutationOptions<UpdateLectureResponse, Error, UpdateLectureVariables>
) => {
    const queryClient = useQueryClient();
    const {
        onSuccess,
        onError,
        onSettled,
        onMutate,
        ...restOptions
    } = options ?? {};
    return useMutation({
        mutationFn: async ({ lecture_uuid, ...payload }: UpdateLectureVariables) => {
            return updateLecture(lecture_uuid, payload);
        },
        onSuccess: async (data, variables, context) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["lectures"] }),
                queryClient.invalidateQueries({
                    queryKey: ["lecture", variables.lecture_uuid],
                    exact: true,
                }),
            ]);
            onSuccess?.(data, variables, context);
        },
        onError,
        onSettled,
        onMutate,
        ...restOptions,
    });
};
