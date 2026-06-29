// ──── FILE: src/types/testmanage.ts ────

// 문제 하나당 상태: 풀이 안 함, 정답, 오답
export type ProblemStatus = "none" | "correct" | "wrong";

// 응시자 정보(이전 "CompletedItem" 타입)
export interface CompletedItem {
  id: string;
  name: string;
  statuses: ProblemStatus[];
  ip: string;
  startTime: string;
  duration?: string;
  userId?: string;
  finishedByUser?: boolean;
}
