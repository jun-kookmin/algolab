"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/* ───────── 타입 ───────── */
export interface UpdateHomeworkRequest {
  id: string;
  title: string;
  problems: Array<{
    uuid?: string;
    problem_uuid: string;
    problem_id?: string;
    language: number[];
    start_date: string;
    end_date: string;
    points?: number;
  }>;
}

export interface UpdateHomeworkResponse {
  success?: boolean;
}

/* ───────── API ───────── */
const updateHomework = async (
  lectureId: string,
  homeworkId: string,
  payload: UpdateHomeworkRequest
): Promise<UpdateHomeworkResponse> => {
  try {
    const { data } = await BaseApi.put<UpdateHomeworkResponse>(
      `/instructor/lectures/${lectureId}/homework/${homeworkId}/`,
      payload
    );
    return data;
  } catch (err: any) {
    if (err.response) {
      // console.log("status:", err.response.status);
      // console.log("data:", err.response.data);
      // console.log("url:", err.config?.url);
      // console.log("method:", err.config?.method);
    }
    throw err;
  }
};

/* ───────── Hook ───────── */
export const useUpdateHomework = (lectureId?: string, homeworkId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateHomeworkRequest) =>
      updateHomework(lectureId!, homeworkId!, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["homework", lectureId ?? "", homeworkId ?? ""],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ["homeworks", lectureId ?? ""],
          exact: true,
        }),
      ]);
    },
  });
};
