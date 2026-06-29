// ──── FILE: src/hooks/solve/homework/POST/usePostHomeworkRun.ts ────
"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { fetchWithCsrfRetry } from "@/utils/csrf";
import { getApiBase } from "@/utils/apiBase";

export interface HomeworkRunBody {
    section_problem_id: string;
    language: string;                 // 예: "C++", "Python"
    code: Record<string, string>;     // { "main.py": "print(...)", ... }
    input_data?: string | null;
}

// env 기반 URL 생성
const getRunHomeworkUrl = (): string => {
    const normalizedBase = getApiBase();

    // 최종 URL: https://.../api/v1/instructor/execution/run/
    return `${normalizedBase}/instructor/execution/run/`;
};

const postHomeworkRun = async (body: HomeworkRunBody): Promise<unknown> => {
    const url = getRunHomeworkUrl();

    // 🔥 요청 로그
    // console.log("===== [실행] 코드 실행 fetch 요청 =====");
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
    // console.log("===== [실행] 코드 실행 fetch 응답 =====");
    // console.log("[STATUS]", res.status);
    // console.log("[RAW]   ", rawText);

    if (!res.ok) {
        throw new Error(
            `코드 실행 요청 실패 (${res.status}): ${rawText || "<no response body>"
            }`
        );
    }

    try {
        return rawText ? JSON.parse(rawText) : null;
    } catch {
        return rawText || null;
    }
};

export const usePostHomeworkRun = (): UseMutationResult<
    unknown,
    Error,
    HomeworkRunBody
> => {
    return useMutation<unknown, Error, HomeworkRunBody>({
        mutationFn: postHomeworkRun,
    });
};
