"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/* ───────── API ───────── */

const removeLectureMember = async (
  lectureId: string,
  memberKey: string | number
): Promise<void> => {
  await BaseApi.delete(
    `/instructor/lectures/${lectureId}/members/${memberKey}/`
  );
};

/* ───────── Hook ───────── */

/**
 * 강의 내부 학생 삭제 훅
 * - DELETE /api/v1/lectures/{lid}/members/{uid}
 * - 성공 시 `lectureMembers` 캐시 무효화 (목록 자동 갱신)
 */
export const useRemoveLectureMember = (lectureId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberKey: string | number) =>
      removeLectureMember(lectureId!, memberKey),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["lectureMembers", lectureId],
      });
    },
  });
};
