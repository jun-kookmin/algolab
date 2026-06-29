"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/* ───────── 타입 ───────── */
// 시험 추가 요청 타입
// 서버에서는 시험 이름을 `exam_name` 필드로, 설명을 `description` 필드로 받습니다.
// description 필드는 선택 사항입니다.
export interface AddExamRequest {
  exam_name: string;
  description?: string;  // ← optional
  start_date?: string;
  due_date?: string;
}


// 시험 추가 응답 타입
// 서버는 새로 생성된 시험의 ID와 함께 이름 및 설명을 반환합니다.
export interface AddExamResponse {
  id: string;
  uuid: string;
  exam_name: string;
  description?: string;
  week: number;
  start_date: string;
  due_date: string;
  share: boolean;
}

/* ───────── API ───────── */
// 특정 강의(lectureId)에 시험을 생성하는 비동기 함수
// `/instructor/lectures/{lectureId}/exams/` 엔드포인트로 POST 요청을 보냅니다.
const addExam = async (
  lectureId: string,
  payload: AddExamRequest
): Promise<AddExamResponse> => {
  // 현재 날짜와 다음날 날짜를 ISO 문자열로 계산
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // 주차와 공유 여부는 임의의 기본값을 사용합니다.
  const week = 1;
  const share = true;
  // API에서 요구하는 전체 payload 구성
  const fullPayload = {
    exam_name: payload.exam_name,
    description: payload.description ?? "",
    week,
    share,
    start_date: payload.start_date ?? now.toISOString().slice(0, 16),
    due_date: payload.due_date ?? tomorrow.toISOString().slice(0, 16),
  };
  const { data } = await BaseApi.post<unknown>(
    `/instructor/lectures/${lectureId}/exams/`,
    fullPayload
  );
  const raw = data as any;
  const uuid = String(raw?.exam_uuid ?? raw?.uuid ?? raw?.id ?? "");
  return {
    ...raw,
    uuid,
    id: uuid,
    exam_name: raw?.exam_name ?? raw?.title ?? "",
  } as AddExamResponse;
};

/* ───────── Hook ───────── */
// 시험 추가를 위한 custom hook
// react-query의 useMutation을 사용하여 시험을 생성하고,
// 성공 시 해당 강의의 exam 목록 캐시를 무효화합니다.
export const useAddExam = (lectureId?: string) => {
  const qc = useQueryClient();
  const key = ["exams", lectureId] as const;
  return useMutation({
    mutationFn: (payload: AddExamRequest) => {
      if (lectureId == null) throw new Error("lectureId is required");
      return addExam(lectureId, payload);
    },
    onSuccess: async (created, variables) => {
      const uuid = String(created?.uuid ?? created?.id ?? "");
      const normalized = {
        ...created,
        uuid,
        id: uuid,
        exam_name: created?.exam_name ?? (created as any)?.title ?? "",
        start_date: created?.start_date ?? variables.start_date,
        due_date: created?.due_date ?? variables.due_date,
      };
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData(key, (old: unknown) => {
        if (!old) {
          return { exam: [normalized], results: [normalized] };
        }
        if (Array.isArray(old)) {
          const merged = [
            normalized,
            ...old.filter((e: any) => String(e?.id ?? e?.uuid ?? "") !== uuid),
          ];
          return { exam: merged, results: merged };
        }
        const prevExam = Array.isArray((old as any).exam)
          ? (old as any).exam
          : Array.isArray((old as any).results)
          ? (old as any).results
          : [];
        const merged = [
          normalized,
          ...prevExam.filter((e: any) => String(e?.id ?? e?.uuid ?? "") !== uuid),
        ];
        return { ...(old as any), exam: merged, results: merged };
      });
      await qc.invalidateQueries({ queryKey: key, refetchType: "all" });
    },
  });
};
