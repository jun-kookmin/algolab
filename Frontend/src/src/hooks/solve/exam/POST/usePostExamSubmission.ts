// ──── FILE: src/hooks/solve/exam/POST/usePostExamSubmission.ts ────
"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { fetchWithCsrfRetry } from "@/utils/csrf";
import { getApiBase } from "@/utils/apiBase";

export interface ExamSubmissionBody {
    user?: number;
    exam_uuid?: string;
    exam_id?: string;
    exam_problem_uuid?: string;
    exam_problem_id?: string;
    status?: string;
    code: string | Record<string, string>;
    submission_count?: number;
    judge_count?: number;
    language: string;         // 예: "C++", "Python"
    submission_time?: string; // ISO 문자열
}

// env 기반 URL 생성
const getExecExamUrl = (): string => {
    const normalizedBase = getApiBase();

    // 최종 URL: https://.../api/v1/instructor/execution/grade/exam/
    return `${normalizedBase}/instructor/execution/grade/exam/`;
};

const postExamSubmission = async (
    body: ExamSubmissionBody
): Promise<unknown> => {
    const url = getExecExamUrl();

    // 🔥 요청 로그
    // console.log("===== [시험 제출/채점 fetch 요청] =====");
    // console.log("[URL]   ", url);
    // console.log("[BODY]  ", body);
    // console.log("[BODY(JSON)]\n" + JSON.stringify(body, null, 2));

    const res = await fetchWithCsrfRetry(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
    });

    const rawText = await res.text().catch(() => "");

    // 🔥 응답 로그
    // console.log("===== [시험 제출/채점 fetch 응답] =====");
    // console.log("[STATUS]", res.status);
    // console.log("[RAW]   ", rawText);

    if (!res.ok) {
        throw new Error(
            `시험 제출/채점 요청 실패 (${res.status}): ${rawText || "<no response body>"
            }`
        );
    }

    try {
        return rawText ? JSON.parse(rawText) : null;
    } catch {
        return rawText || null;
    }
};

export const usePostExamSubmission = (): UseMutationResult<
    unknown,
    Error,
    ExamSubmissionBody
> => {
    return useMutation<unknown, Error, ExamSubmissionBody>({
        mutationFn: postExamSubmission,
    });
};
