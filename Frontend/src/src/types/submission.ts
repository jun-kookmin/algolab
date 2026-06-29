// types/submission.ts
export type Judge =
  | "정답"
  | "오답"
  | "컴파일 오류"
  | "런타임 오류"
  | "에러"
  | "시간 초과"
  | "메모리 초과"
  | "미제출";

export interface Submission {
  id?: string | number;
  problem: string;
  judge: Judge;
  score: number;
  code: string;
  language: number[] | string[];
  execTime: number; // ms
  memory: number; // KB
  codeSize: number; // byte
  submittedAt: string; // 'YYYY-MM-DD HH:mm' 등
}
