// ──── FILE: src/types/submit.ts ────

// 문제별 정오/부분/미채점 상태
export interface Answer {
  questionNumber: number; // 문항 번호 (1-based)
  questionId?: string; // 문제 UUID (내부 매핑용)
  status: "정답" | "오답" | "미채점" | "지각"; // 채점 결과
  attempts: number; // 총 제출 횟수
  firstCorrectAttempts?: number | null; // 첫 정답 시 제출 횟수
  score: number;
}

// 제출 정보 인터페이스
export interface SubmitInfo {
  id: number; // 고유 ID
  name: string; // 학생 이름
  studentId: string; // 학번(8자리)
  score: number; // 맞은 개수
  total: number; // 총 문제 수
  answers: Answer[]; // 문제별 상태
}
const makeAnswers = (total: number): Answer[] =>
  Array.from({ length: total }, (_, i) => ({
    questionNumber: i + 1,
    status: (i + 1) % 6 === 0 ? "미채점" : (i + 1) % 4 === 0 ? "오답" : "정답",
    attempts: ((i + 1) % 3) + 1, // 1~3회
    firstCorrectAttempts: ((i + 1) % 3) + 1,
    score: 0,
  }));
/** 예시 이름 20개 */
const names = Array.from(
  { length: 20 },
  (_, index) => `Student ${String(index + 1).padStart(2, "0")}`
);

export const dummySubmits: SubmitInfo[] = names.map((name, idx) => {
  const answers = makeAnswers(30);
  const score = answers.filter((a) => a.status === "정답").length;

  return {
    id: idx + 1,
    name,
    studentId: `STUDENT${String(idx + 1).padStart(3, "0")}`,
    score,
    total: 30,
    answers,
  };
});
