// src/hooks/lectures/useGetLectureMembers.ts
"use client";

import BaseApi from "@/utils/api";
import { formatDisplayName } from "@/utils/name";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export type MemberRole = "PROFESSOR" | "STUDENT";

export interface LectureMember {
  user_id: number;
  name: string;
  role: MemberRole;
  joined_at: string;
  full_name?: string;
  student_code?: string;
}

export interface LectureMembersResponse {
  total: number;
  page: number;
  size: number;
  members: LectureMember[]; // ✅ 최종적으로 컴포넌트에서 사용할 구조
}

// ✅ 백엔드 원본 응답 타입 (data 배열로 내려옴)
interface RawLectureMembersResponse {
  total: number;
  page?: number;
  size: number;
  data: LectureMember[];
}

const fetchLectureMembers = async (
  lectureId: string
): Promise<LectureMembersResponse> => {
  // ✅ 제네릭을 Raw로 받고
  const { data } = await BaseApi.get<RawLectureMembersResponse>(
    `instructor/lectures/${lectureId}/members/`
  );

  // console.log(data, "raw 데이터"); // { total, page, size, data: [...] }

  // ✅ 여기서 원하는 구조로 매핑해서 반환
  return {
    total: data.total,
    page: data.page ?? 1,
    size: data.size ?? 0,
    members: (data.data ?? []).map((m: any) => {
      const rawName = m.full_name ?? m.name ?? "";
      const normalized = formatDisplayName(rawName);
      return {
        ...m,
        name: m.name ? formatDisplayName(m.name) : normalized,
        full_name: normalized,
      };
    }), // <-- 핵심
  };
};

export const useGetLectureMembers = (
  lectureId: string,
  options?: Omit<
    UseQueryOptions<LectureMembersResponse, Error, LectureMembersResponse>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery({
    queryKey: ["lectureMembers", lectureId],
    queryFn: () => fetchLectureMembers(lectureId),
    enabled: (options?.enabled ?? true) && !!lectureId,
    staleTime: 60_000,
    ...(options ?? {}),
  });
};
