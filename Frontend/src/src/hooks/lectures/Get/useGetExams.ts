// src/hooks/lectures/useGetExams.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

/** 서버 응답 스펙 그대로 사용 (정규화 없음) */
export interface ExamItem {
    id: string;
    uuid: string;
    exam_name: string;
    title?: string;
    description?: string;
    problem_count?: number;
    start_date?: string;    // ISO
    due_date?: string;      // ISO
    startDate?: string;
    dueDate?: string;
    start_at?: string;
    due_at?: string;
}

export interface GetExamsResponse {
    exam: ExamItem[];      // 리스트는 exams 키에 담겨온다고 가정
    results?: ExamItem[];
}

const parseDateMs = (value?: string): number => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
};

const compareExamDesc = (a: ExamItem, b: ExamItem): number => {
    const startDiff = parseDateMs(b.start_date) - parseDateMs(a.start_date);
    if (startDiff !== 0) return startDiff;

    const dueDiff = parseDateMs(b.due_date) - parseDateMs(a.due_date);
    if (dueDiff !== 0) return dueDiff;

    return String(b.id ?? "").localeCompare(String(a.id ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
    });
};

const pickDateTimeValue = (raw: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
        const value = raw[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }
    return "";
};

/** fetcher */
export const fetchExams = async (lectureId: string): Promise<GetExamsResponse> => {
    const { data } = await BaseApi.get<unknown>(
        `/instructor/lectures/${lectureId}/exams/`
    );
    const payload = data as any;
    const items = Array.isArray(payload?.exam)
      ? payload.exam
      : Array.isArray(payload?.results)
      ? payload.results
      : [];
    const normalized = items.map((e: any) => {
        const source = e ?? {};
        return {
            ...e,
            uuid: String(source.uuid ?? source.id ?? ""),
            id: String(source.uuid ?? source.id ?? ""),
            start_date: pickDateTimeValue(source, [
                "start_date",
                "startDate",
                "start_at",
                "startAt",
            ]),
            due_date: pickDateTimeValue(source, [
                "due_date",
                "dueDate",
                "due_at",
                "dueAt",
            ]),
        };
    }).sort(compareExamDesc);
    return {
      exam: normalized,
      results: normalized,
    };
};

/** 커스텀 훅 */
export const useGetExams = (
    lectureId?: string,
    options?: Omit<
        UseQueryOptions<GetExamsResponse, Error, GetExamsResponse>,
        "queryKey" | "queryFn" | "select"
    >
) => {
    return useQuery({
        queryKey: ["exams", lectureId],
        queryFn: () => fetchExams(lectureId as string),
        enabled: !!lectureId,
        staleTime: 60_000,
        placeholderData: (prev) => prev,
        refetchOnWindowFocus: false,
        ...options,
        select: (data) => data.exam ?? [],
    });
};
