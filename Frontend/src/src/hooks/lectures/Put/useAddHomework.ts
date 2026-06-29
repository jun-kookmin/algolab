"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/* ───────── 타입 ───────── */
export interface AddHomeworkRequest {
  name: string;          // 서버는 title 대신 name 필드 사용
  description?: string;
  start_date?: string;
  end_date?: string;
}

export interface AddHomeworkResponse {
  id: string;
  uuid: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

/* ───────── API ───────── */
const addHomework = async (
  lectureId: string,
  payload: AddHomeworkRequest
): Promise<AddHomeworkResponse> => {
  const { data } = await BaseApi.post<unknown>(
    `/instructor/lectures/${lectureId}/homework/`,
    {
      name: payload.name,
      description: payload.description,
    }
  );
  const raw = data as any;
  const uuid = String(raw?.uuid ?? raw?.id ?? "");
  return {
    ...raw,
    uuid,
    id: uuid,
    start_date: raw?.start_date ?? payload.start_date,
    end_date: raw?.end_date ?? payload.end_date,
  } as AddHomeworkResponse;
};

/* ───────── Hook ───────── */
export const useAddHomework = (lectureId?: string) => {
  const qc = useQueryClient();
  const key = ["homeworks", lectureId] as const;
  return useMutation({
    mutationFn: (payload: AddHomeworkRequest) => {
      if (lectureId == null) {
        throw new Error("lectureId is required");
      }
      return addHomework(lectureId, payload);
    },
    onSuccess: async (created, variables) => {
      const uuid = String(created?.uuid ?? created?.id ?? "");
      const normalized = {
        ...created,
        uuid,
        id: uuid,
        title: (created as any)?.title ?? created?.name ?? "",
        start_date: created?.start_date ?? variables.start_date,
        end_date: created?.end_date ?? variables.end_date,
      };
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData(key, (old: unknown) => {
        if (!old) {
          return { homeworks: [normalized] };
        }
        if (Array.isArray(old)) {
          const merged = [normalized, ...old.filter((h: any) => String(h?.id ?? h?.uuid ?? "") !== uuid)];
          return { homeworks: merged };
        }
        const prev = Array.isArray((old as any).homeworks) ? (old as any).homeworks : [];
        const merged = [
          normalized,
          ...prev.filter((h: any) => String(h?.id ?? h?.uuid ?? "") !== uuid),
        ];
        return { ...(old as any), homeworks: merged };
      });
      await qc.invalidateQueries({ queryKey: key, refetchType: "all" });
    },
  });
};
