"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

/**
 * 단일 시험 삭제 API 호출
 * @param lectureId 강의 uuid
 * @param examId 시험 uuid
 */
const deleteExam = async (
  lectureId: string,
  examId: string
): Promise<void> => {
  // DELETE 요청: /instructor/lectures/{lectureId}/exams/{examId}/
  await BaseApi.delete(`/instructor/lectures/${lectureId}/exams/${examId}/`);
};

/**
 * 시험 삭제 훅
 * - lectureId는 훅 생성 시 고정
 * - examId는 mutate에 variables로 전달
 * - onMutate에서 낙관적으로 목록에서 제거하고, 실패 시 롤백
 * - onSettled에서 항상 최신 목록을 불러오도록 invalidateQueries 호출
 */
export const useRemoveExam = (lectureId?: string) => {
  const qc = useQueryClient();
  // useGetExams와 동일한 쿼리 키 사용
  const key = ["exams", lectureId] as const;

  return useMutation<
    void,          // TData (성공 값 없음)
    unknown,       // TError (특정 에러 타입 미정)
    string,        // TVariables (examUuid)
    { previous: unknown } // TContext (rollback용 이전 값)
  >({
    // 실제 DELETE 요청
    mutationFn: async (examId) => {
      if (lectureId == null) {
        throw new Error("lectureId가 유효하지 않습니다.");
      }
      await deleteExam(lectureId, examId);
    },

    // 낙관적 업데이트: 캐시에서 미리 제거
    onMutate: async (examId) => {
      // 진행 중인 동일 쿼리 취소
      await qc.cancelQueries({ queryKey: key });

      // 이전 캐시 스냅샷 저장
      const previous = qc.getQueryData(key);

      // 캐시 구조에 따라 안전하게 시험 항목 제거
      qc.setQueryData(key, (old: any) => {
        if (!old) return old;

        // 배열 형태일 때
        if (Array.isArray(old)) {
          return old.filter((e: any) => {
            const uuid = e?.uuid ?? e?.exam_uuid ?? e?.id ?? e?.exam_id;
            return uuid !== examId;
          });
        }
        // exams 속성에 배열이 있을 때
        if (Array.isArray(old.exams)) {
          return {
            ...old,
            exams: old.exams.filter((e: any) => {
              const uuid = e?.uuid ?? e?.exam_uuid ?? e?.id ?? e?.exam_id;
              return uuid !== examId;
            }),
          };
        }
        // exam 속성(단수형)에 배열이 있을 때
        if (Array.isArray(old.exam)) {
          return {
            ...old,
            exam: old.exam.filter((e: any) => {
              const uuid = e?.uuid ?? e?.exam_uuid ?? e?.id ?? e?.exam_id;
              return uuid !== examId;
            }),
          };
        }
        // results 속성에 배열이 있을 때 (페이지네이션 구조)
        if (Array.isArray(old.results)) {
          return {
            ...old,
            results: old.results.filter((e: any) => {
              const uuid = e?.uuid ?? e?.exam_uuid ?? e?.id ?? e?.exam_id;
              return uuid !== examId;
            }),
          };
        }
        // 그 외의 구조는 그대로 반환
        return old;
      });

      return { previous };
    },

    // 실패 시 이전 상태로 롤백
    onError: (_err, _examId, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(key, context.previous);
      }
    },

    // 성공/실패 여부와 관계없이 마지막에 쿼리 무효화
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
};
