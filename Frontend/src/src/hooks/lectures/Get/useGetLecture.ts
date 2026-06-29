// src/hooks/lectures/useGetLecture.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

/** ===== 타입 ===== */
export interface Lecture {
    id: string;
    uuid: string;
    name: string;
    description: string;
    start_date: string;         // ISO
    end_date: string;           // ISO
    created_date?: string;      // ISO
    weeks?: number;
    lecture_language?: number[];
    language?: Array<{ id: number; language_name: string }>;
    is_delete?: boolean;
    code?: string;              // 서버에서 제공하면 사용
    curriculum_locked?: boolean;
    server_time?: string;
}

/** ===== fetcher: 인자 → API 호출 → data 반환 =====
 *  백엔드가 { data: {...} } 또는 {...} 형태 둘 다 대응
 */
export const fetchLecture = async (lectureId: string): Promise<Lecture> => {
    const resp = await BaseApi.get<unknown>(
        `/instructor/lectures/${lectureId}/`
    );
    const payload: any = resp?.data;
    const data = (payload && typeof payload === "object" && "data" in payload)
        ? (payload as any).data
        : payload;

    if (!data || typeof data !== "object") {
        throw new Error("Unexpected response shape for lecture detail");
    }
    const raw = data as any;
    const uuid = String(raw.uuid ?? raw.id ?? "");
    return {
        ...raw,
        uuid,
        id: uuid,
    } as Lecture;
};

/** ===== 커스텀 훅 ===== */
export const useGetLecture = (
    lectureId?: string,
    options?: Omit<
        UseQueryOptions<Lecture, Error, Lecture>,
        "queryKey" | "queryFn"
    >
) => {
    return useQuery({
        queryKey: ["lecture", lectureId],
        queryFn: () => fetchLecture(lectureId as string),
        enabled: !!lectureId,     // id가 있어야 호출
        staleTime: 60_000,
        ...(options ?? {}),
    });
};
