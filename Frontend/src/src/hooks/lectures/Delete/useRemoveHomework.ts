
// ──── FILE: hooks/lectures/Delete/useRemoveHomework.ts ────
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";


/**
 * 단일 과제 삭제 API 호출
 * @param lectureId 강의 uuid
 * @param homeworkId 과제 uuid
 */

const deleteHomework = async (
  lectureId: string,
  homeworkId: string
): Promise<void> => {

  await BaseApi.delete(`/instructor/lectures/${lectureId}/homework/${homeworkId}/`);
};

/**
 * 과제 삭제 훅
 * - lectureId는 훅 생성 시 고정
 * - homeworkId는 mutate에 variables로 전달
 * - onMutate에서 낙관적으로 목록에서 제거하고, 실패 시 롤백
 * - onSettled에서 항상 최신 목록을 불러오도록 invalidateQueries 호출
 */
export const useRemoveHomework = (lectureId?: string) => {
  const qc = useQueryClient();
  // 캐시 키 고정
  const key = ["homeworks", lectureId] as const;

  return useMutation<
    void,          // TData (성공 값 없음)
    unknown,       // TError (특정 에러 타입 미정)
    string,        // TVariables (homeworkUuid)
    { previous: unknown } // TContext (rollback용 이전 값)
  >({
    // 실제 DELETE 요청
    mutationFn: async (homeworkId) => {
      if (lectureId == null) {
        throw new Error("lectureId가 유효하지 않습니다.");
      }
      await deleteHomework(lectureId, homeworkId);
    },

    // 낙관적 업데이트: 캐시에서 미리 제거
    onMutate: async (homeworkId) => {
      // 진행 중인 동일 쿼리 취소
      await qc.cancelQueries({ queryKey: key });

      // 이전 캐시 스냅샷
      const previous = qc.getQueryData(key);

      // 캐시 형태에 따라 안전하게 필터링
      qc.setQueryData(key, (old: any) => {
        // 배열일 경우: 그대로 필터
        if (Array.isArray(old)) {
          return old.filter((h: any) => {
            const uuid = h?.uuid ?? h?.homework_uuid ?? h?.id;
            return uuid !== homeworkId;
          });
        }
        // 객체 안에 homeworks 배열이 있을 경우: homeworks만 수정
        if (old && Array.isArray((old as any).homeworks)) {
          return {
            ...(old as any),
            homeworks: (old as any).homeworks.filter((h: any) => {
              const uuid = h?.uuid ?? h?.homework_uuid ?? h?.id;
              return uuid !== homeworkId;
            }),
          };
        }
        // 그 외의 경우: 그대로 유지
        return old;
      });

      return { previous };
    },

    // 실패 시 롤백
    onError: (_err, _homeworkId, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(key, context.previous);
      }
    },

    // 성공/실패와 무관하게 캐시 최종 동기화
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
};
