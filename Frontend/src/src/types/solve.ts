// ─── src/types/solve.ts ───

// 지원 언어 상수 & 유니온 타입
export const ALL_LANGS = ['c', 'cpp', 'python', 'java'] as const;
export type LangKey = typeof ALL_LANGS[number];

// 파일 단위 코드 데이터
export interface FileData {
  filename: string;
  language: string; // 다른 모듈 호환을 위해 넓게 유지(=string)
  code: string;
}

// 현재 편집 중 상태에 쓰는 구조
export interface ProblemData {
  code: FileData[];
  language: LangKey;
}

// 화면 표시용 문제 데이터
export interface ProblemUI {
  id: string;                       // section_problem_uuid (문자열)
  problemUuid?: string;             // 실제 Problem UUID (시험 문제일 때 사용)
  title: string;
  description: string;
  pdf: string | null;               // undefined → null 정규화
  limit_time?: number | null;
  limit_memory?: number | null;
  languages: LangKey[];
  templatesByLang: Record<LangKey, FileData[]>;
  defaultLang: LangKey;
}
