// ──── FILE: src/hooks/useLocationState.ts ────
"use client"; // 클라이언트 훅에서만 사용 가능

import { useSearchParams } from "next/navigation";

interface LocationState {
    state?: {
        problems?: unknown;
    };
}

/**
 * CRA의 location.state?.problems를 흉내 내기 위한 훅.
 * 예: /solve?problems=["문제1","문제2"] 이렇게 전달 시,
 *     location.state?.problems === ["문제1","문제2"] 로 동작하도록.
 */
export function useLocationState(): LocationState {
    const searchParams = useSearchParams();
    const problemsParam = searchParams.get("problems");

    let parsedProblems: unknown = undefined;
    if (problemsParam) {
        try {
            parsedProblems = JSON.parse(problemsParam);
        } catch {
            // console.error("Failed to parse `problems` query param.", err);
        }
    }

    return {
        state: {
            problems: parsedProblems,
        },
    };
}
