// src/hooks/lectures/useGetLectureMember.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { MemberRole } from "@/hooks/lectures/Get/useGetLectureMembers";

export interface LectureMemberDetail {
  user_id: number;
  name: string;
  role: MemberRole; // "PROFESSOR" | "STUDENT"
  joined_at: string;
  /** 백엔드에서 미제출 상태일 때 null/undefined일 가능성 고려 */
  last_submission_at: string | null;
}

/** 단일 멤버 조회 요청 */
const fetchLectureMember = async (
  lectureId: string,
  userId: number
): Promise<LectureMemberDetail> => {
  const { data } = await BaseApi.get<LectureMemberDetail>(
    `instructor/lectures/${lectureId}/members/${userId}/`
  );

  return {
    ...data,
    last_submission_at: data.last_submission_at ?? null,
  };
};

/**
 * React Query 훅: 단일 멤버 조회
 * - GET /api/v1/lectures/{lid}/members/{uid}
 * - 30초마다 갱신(목록 훅과 동일 정책)
 */
export const useGetLectureMember = (lectureId?: string, userId?: number) => {
  return useQuery({
    queryKey: ["lectureMember", lectureId, userId],
    queryFn: () => fetchLectureMember(lectureId!, userId!),
    enabled: !!lectureId && !!userId,
    staleTime: 60_000,
  });
};
