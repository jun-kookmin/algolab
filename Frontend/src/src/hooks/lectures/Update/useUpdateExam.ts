"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/* ───────── 타입 ───────── */
/**
 * 시험에 문제를 추가하거나 교체할 때 사용하는 요청 타입입니다.
 * 서버가 ListSerializer(many=True)를 사용하므로
 * 최상위 배열 형태로 전송해야 합니다.
 */
export type ExamProblemUpsert = {
  /** 문제 ID */
  problem: string;
  /** 문제 점수 */
  score: number;
};

// top-level 배열 형태
export type AddExamProblemRequest = ExamProblemUpsert[];

/**
 * 응답 타입입니다. 백엔드에서 success 여부나 기타 정보를 반환할 수 있습니다.
 */
export interface AddExamProblemResponse {
  success?: boolean;
  [key: string]: any;
}

/* ───────── API ───────── */
/**
 * 특정 강의의 시험 문제 목록을 PUT으로 교체합니다.
 * 백엔드가 many=True로 되어 있으므로, 배열을 그대로 전송해야 합니다.
 */
const addExamProblem = async (
  lectureId: number | string,
  examId: number | string,
  payload: AddExamProblemRequest
): Promise<AddExamProblemResponse> => {
  try {
    if (!Array.isArray(payload)) {
      throw new Error("payload must be an array like [{ problem, score }, ...]");
    }

    const { data } = await BaseApi.put<AddExamProblemResponse>(
      `/instructor/lectures/${lectureId}/exams/${examId}/problems/`,
      payload
    );
    return data;
  } catch (err: any) {
    if (err.response) {
      // console.error("status:", err.response.status);
      // console.error("data:", err.response.data);
      // console.error("url:", err.config?.url);
      // console.error("method:", err.config?.method);
    }
    throw err;
  }
};

/* ───────── Hook ───────── */
/**
 * React Query를 사용한 훅입니다.
 * mutate([{ problem, score }, ...]) 형태로 호출해야 합니다.
 */
export const useUpdateExam = (
  lectureId?: number | string,
  examId?: number | string
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddExamProblemRequest) =>
      addExamProblem(lectureId!, examId!, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["exam", String(lectureId ?? ""), String(examId ?? "")],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ["exams", String(lectureId ?? "")],
          exact: true,
        }),
      ]);
    },
  });
};
