// src/constants/types/difficulties.ts
export const DIFFICULTIES = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;

export type ProblemDifficulty = typeof DIFFICULTIES[keyof typeof DIFFICULTIES];

/** 대소문자 무시 표준화 */
export function toDifficulty(v: unknown): ProblemDifficulty | undefined {
  if (typeof v !== "string") return undefined;
  const upper = v.trim().toUpperCase();
  return (Object.values(DIFFICULTIES) as string[]).includes(upper)
    ? (upper as ProblemDifficulty)
    : undefined;
}



/** 가중치 테이블 (정렬/점수화 용) */
export const DIFFICULTY_WEIGHT: Record<ProblemDifficulty, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

/** 어떤 입력이 와도 안전하게 가중치 반환 (없으면 기본값) */
export function weightOf(
  v: unknown,
  fallback: ProblemDifficulty = DIFFICULTIES.MEDIUM
): number {
  const d = toDifficulty(v) ?? fallback;
  return DIFFICULTY_WEIGHT[d];
}

/** 난이도 오름차순 비교자 (EASY < MEDIUM < HARD) */
export function compareDifficulty(a: unknown, b: unknown): number {
  return weightOf(a) - weightOf(b);
}
