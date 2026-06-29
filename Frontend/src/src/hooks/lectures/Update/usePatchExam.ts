// ──── FILE: src/hooks/lectures/Update/usePatchExam.ts ────
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/* ───────── 타입 ───────── */
/** Swagger 스펙 기준 PATCH payload */
export interface PatchExamRequest {
    lecture?: string;               // 백엔드가 요구하면 그대로 전달
    exam_name?: string;
    description?: string;
    week?: number;
    start_date?: string;            // ISO string
    due_date?: string;              // ISO string
    share?: boolean;
}

/** 응답 타입(필요시 확장) */
export interface PatchExamResponse {
    success?: boolean;
    id?: string;
    lecture?: string;
    exam_name?: string;
    description?: string;
    week?: number;
    start_date?: string;
    due_date?: string;
    share?: boolean;
    [key: string]: any;
}

/* ───────── API ───────── */
/**
 * 시험 메타데이터(이름/설명/주차/시작~마감/공유여부)를 PATCH로 수정합니다.
 * @param lectureId 강의 ID (path param: lectures_pk)
 * @param examId    시험 ID  (path param: id)
 * @param payload   수정할 필드만 부분 전달
 */
const patchExamMeta = async (
    lectureId: number | string,
    examId: number | string,
    payload: PatchExamRequest
): Promise<PatchExamResponse> => {
    try {
        const { data } = await BaseApi.patch<PatchExamResponse>(
        `/instructor/lectures/${lectureId}/exams/${examId}/`,
        payload
        );
        return data;
    } catch (err: any) {
        if (err?.response) {
        // console.error("PATCH /exams error");
        // console.error("status:", err.response.status);
        // console.error("data:", err.response.data);
        // console.error("url:", err.config?.url);
        // console.error("method:", err.config?.method);
        }
        throw err;
    }
    };

/* ───────── Hook ───────── */
/**
 * 사용 예)
 * const patchExam = usePatchExam(lectureId, examId);
 * patchExam.mutate({ start_date, due_date });
 */
export const usePatchExam = (
    lectureId?: number | string,
    examId?: number | string
    ) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: PatchExamRequest) =>
        patchExamMeta(lectureId!, examId!, payload),
        onSuccess: async () => {
        await Promise.all([
            queryClient.invalidateQueries({
            queryKey: ["exam", String(lectureId ?? ""), String(examId ?? "")],
            exact: true,
            }),
            queryClient.invalidateQueries({
            queryKey: ["exams", String(lectureId ?? "")],
            exact: true,
            }),
        ]);
        },
    });
};
