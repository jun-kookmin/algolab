// ──── FILE: src/hooks/solve/exam/POST/usePostExamRun.ts ────
"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { fetchWithCsrfRetry } from "@/utils/csrf";
import { getApiBase } from "@/utils/apiBase";

export interface ExamRunBody {
    section_problem_uuid?: string;
    section_problem_id?: string;
    exam_problem_uuid?: string;
    exam_problem_id?: string;
    problem_uuid?: string;
    language: string;                 // 예: "C++", "Python"
    code: Record<string, string>;     // { "main.py": "print(...)", ... }
    input_data?: string | null;
}

// env 기반 URL 생성 (과제 실행과 동일 엔드포인트 사용)
const getRunExamUrl = (): string => {
    const normalizedBase = getApiBase();

    // 최종 URL: https://.../api/v1/instructor/execution/run/
    return `${normalizedBase}/instructor/execution/run/`;
};

const postExamRun = async (body: ExamRunBody): Promise<unknown> => {
    const url = getRunExamUrl();

    // 🔥 요청 로그
    // console.log("===== [시험 실행] 코드 실행 fetch 요청 =====");
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
    // console.log("===== [시험 실행] 코드 실행 fetch 응답 =====");
    // console.log("[STATUS]", res.status);
    // console.log("[RAW]   ", rawText);

    if (!res.ok) {
        throw new Error(
            `시험 코드 실행 요청 실패 (${res.status}): ${rawText || "<no response body>"
            }`
        );
    }

    try {
        return rawText ? JSON.parse(rawText) : null;
    } catch {
        return rawText || null;
    }
};

export const usePostExamRun = (): UseMutationResult<
    unknown,
    Error,
    ExamRunBody
> => {
    return useMutation<unknown, Error, ExamRunBody>({
        mutationFn: postExamRun,
    });
};
