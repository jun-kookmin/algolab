// src/hooks/problems/usePatchProblem.ts
"use client";

import BaseApi from "@/utils/api";
import { useMutation, UseMutationOptions, useQueryClient } from "@tanstack/react-query";

/** PATCH 바디 스키마(부분수정) - 백엔드 Serializer 키와 일치시킴 */
export interface PatchProblemBody {
    title?: string;                               // serializer: title -> model.problem_name
    description?: string;                         // serializer: description -> model.description
    type?: "GENERAL" | "CHECKER";
    difficulty?: "EASY" | "MEDIUM" | "HARD";
    limit_time?: number;
    limit_memory?: number;
    checker_code?: string | null;                 // "" 를 보내면 삭제, null/undefined는 미변경
    share?: boolean;
    /** 템플릿 변경 시에만 필요 (백엔드 버그 회피 위해 기본적으로 안 보냄 — 페이지에서 제어) */
    template_codes?: Array<{
        language: string;
        files: { filename: string; content: string }[];
    }>;
    testcases?: Array<{
        input?: {
            index: number;
            content: string;
        };
        output?: {
            index: number;
            content: string;
        };
    }>;
    /** 언어 M2M — 템플릿을 업데이트할 때 함께 보내면 안전 */
    language?: number[];
}

export interface PatchProblemResult {
    ok: boolean;
}

/** 단일 호출 함수 */
export const patchProblem = async (problemId: string, body: PatchProblemBody) => {
    const url = `/instructor/problems/${problemId}/`; // ★ 트레일링 슬래시 필수
    const { data } = await BaseApi.patch<PatchProblemResult>(url, body, {
        headers: { "Content-Type": "application/json" },
    });
    return data;
};

/** 훅 */
export const usePatchProblem = (
    problemId: string,
    options?: UseMutationOptions<PatchProblemResult, any, PatchProblemBody>
) => {
    const qc = useQueryClient();

    return useMutation<PatchProblemResult, any, PatchProblemBody>({
        mutationFn: (body) => patchProblem(problemId, body),
        onSuccess: async (res, variables, ctx) => {
            // 상세/목록 리페치
            await Promise.allSettled([
                qc.invalidateQueries({ queryKey: ["problem", problemId] }),
                qc.invalidateQueries({ queryKey: ["problems"] }),
            ]);
            options?.onSuccess?.(res, variables, ctx);
        },
        onError: (err: any, vars, ctx) => {
            // 서버 응답 전문 찍기
            // console.error("[PATCH ERROR]", {
                // status: err?.response?.status,
                // data: err?.response?.data,
                // headers: err?.response?.headers,
            // });
            options?.onError?.(err, vars, ctx);
        },
        ...options,
    });
};
