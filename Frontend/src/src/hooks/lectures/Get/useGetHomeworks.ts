// src/hooks/lectures/useGetHomeworks.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

/** ===== 타입 ===== */
export interface HomeworkSection {
    id: string;
    uuid: string;
    title: string;
    description?: string;
    problem_count?: number;
    start_date?: string;
    end_date?: string;
}

export interface GetHomeworksResponse {
    homeworks: HomeworkSection[];
}

/** ===== fetcher: 인자 → API 호출 → data 반환 ===== */
export const fetchHomeworks = async (lectureId: string): Promise<GetHomeworksResponse> => {
    const { data } = await BaseApi.get<unknown>(
        `/instructor/lectures/${lectureId}/homework/`
    );
    const payload = data as any;
    const items = Array.isArray(payload?.homeworks) ? payload.homeworks : [];
    return {
        homeworks: items.map((h: any) => ({
            ...h,
            uuid: String(h.uuid ?? h.id ?? ""),
            id: String(h.uuid ?? h.id ?? ""),
        })),
    };
};

/** ===== 커스텀 훅: 캐시키/조건/옵션 설정 ===== */
export const useGetHomeworks = (
    lectureId?: string,
    options?: Omit<
        UseQueryOptions<GetHomeworksResponse, Error, HomeworkSection[]>,
        "queryKey" | "queryFn" | "select"
    >
) => {
    return useQuery({
        queryKey: ["homeworks", lectureId],
        queryFn: () => fetchHomeworks(lectureId as string),
        enabled: (options?.enabled ?? true) && !!lectureId,
        staleTime: 60_000,
        placeholderData: (prev) => prev,
        refetchOnWindowFocus: false,
        ...options,
        select: (data) => data.homeworks ?? [],
    });
};
