// ──── FILE: src/hooks/solve/homework/POST/usePostHomeworkSubmission.ts ────
"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { fetchWithCsrfRetry } from "@/utils/csrf";
import { getApiBase } from "@/utils/apiBase";

export interface HomeworkExecutionBody {
    section_id: string;
    section_problem_id: string;
    language: string; // "python", "cpp" 등
    code: string | Record<string, string>; // 문자열 또는 파일맵
    limit_time?: number;
    limit_memory?: number;
}

// env 기반 URL 생성
const getExecHomeworkUrl = (): string => {
    const normalizedBase = getApiBase();

    // 최종 URL: https://.../api/v1/instructor/execution/grade/homework/
    return `${normalizedBase}/instructor/execution/grade/homework/`;
};

const postHomeworkExecution = async (
    body: HomeworkExecutionBody
): Promise<unknown> => {
    const url = getExecHomeworkUrl();

    // 🔥 요청 로그
    // console.log("===== [실행/채점 fetch 요청] =====");
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
    // console.log("===== [실행/채점 fetch 응답] =====");
    // console.log("[STATUS]", res.status);
    // console.log("[RAW]   ", rawText);

    if (!res.ok) {
        throw new Error(
            `숙제 실행/채점 요청 실패 (${res.status}): ${rawText || "<no response body>"
            }`
        );
    }

    // 응답이 JSON이면 파싱, 아니면 raw 텍스트 반환
    try {
        return rawText ? JSON.parse(rawText) : null;
    } catch {
        return rawText || null;
    }
};

export const usePostHomeworkSubmission = (): UseMutationResult<
    unknown,
    Error,
    HomeworkExecutionBody
> => {
    return useMutation<unknown, Error, HomeworkExecutionBody>({
        mutationFn: postHomeworkExecution,
    });
};
