// src/hooks/lectures/useAddLecture.ts
"use client";

import BaseApi from "@/utils/api";
import {
    useMutation,
    UseMutationOptions,
    useQueryClient,
} from "@tanstack/react-query";

/** 새 강의를 생성할 때 사용하는 요청 타입입니다. */
export interface AddLectureRequest {
    lecture_language: number[];
    name: string;
    description?: string;
    weeks?: number;
    start_date?: string;
    end_date?: string;
    is_delete?: boolean;
    curriculum_locked?: boolean;
}

/** 새 강의 생성 후 서버에서 반환되는 기본 응답 타입입니다. */
export interface AddLectureResponse {
    id: string;
    uuid: string;
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    [key: string]: any;
}

/** 새 강의를 만드는 API 호출 함수입니다. 오류 발생 시 콘솔에 에러 메시지를 출력합니다. */
const addLecture = async (
    payload: AddLectureRequest
): Promise<AddLectureResponse> => {
    try {
        // FormData 없이 payload 자체를 전송합니다.
        const { data } = await BaseApi.post<unknown>(
            "/instructor/lectures/",
            payload
        );
        const raw = data as any;
        const uuid = String(raw?.uuid ?? raw?.id ?? "");
        return { ...raw, uuid, id: uuid } as AddLectureResponse;
    } catch (err: any) {
        // 에러 메시지를 콘솔에 출력합니다.
        if (err.response) {
            // console.error("status:", err.response.status);
            // console.error("data:", err.response.data);
            // console.error("url:", err.config?.url);
            // console.error("method:", err.config?.method);
        } else {
            // console.error(err);
        }
        throw err;
    }
};

/** 강의 생성 mutation 훅입니다. 성공 후 `lectures` 쿼리 캐시를 무효화합니다. */
export const useAddLecture = (
    options?: UseMutationOptions<AddLectureResponse, Error, AddLectureRequest>
) => {
    const queryClient = useQueryClient();
    return useMutation<AddLectureResponse, Error, AddLectureRequest>({
        mutationFn: addLecture,
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: ["lectures"] });
            options?.onSuccess?.(data, variables, context);
        },
        onError: options?.onError,
        onSettled: options?.onSettled,
        onMutate: options?.onMutate,
    });
};
