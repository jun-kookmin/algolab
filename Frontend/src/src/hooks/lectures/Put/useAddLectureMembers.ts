// src/hooks/lectures/useAddLectureMembers.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

export interface AddLectureMemberRequest {
  members: { student_id: string }[];
}

export interface AddLectureMemberResponse {
  success: boolean;
  message?: string;
  members?: Array<{ user_id: number; name: string; student_id: string }>;
}

/* ───────── API ───────── */

const addLectureMembers = async (
  lectureId: string,
  payload: AddLectureMemberRequest
): Promise<AddLectureMemberResponse> => {
  const { data } = await BaseApi.put<AddLectureMemberResponse>(
    `instructor/lectures/${lectureId}/members/`,
    payload
  );
  return data;
};

/* ───────── Hook ───────── */

/**
 * 강의 내부 학생 추가 훅
 * - PUT /api/v1/lectures/{lid}/members
 * - 완료 후 `lectureMembers` 캐시 무효화 (목록 자동 갱신)
 */
export const useAddLectureMembers = (lectureId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddLectureMemberRequest) =>
      addLectureMembers(lectureId!, payload),
    onSuccess: () => {
      // 멤버 목록 캐시 무효화 → useGetLectureMembers 자동 리패치
      queryClient.invalidateQueries({
        queryKey: ["lectureMembers", lectureId],
      });
    },
  });
};
