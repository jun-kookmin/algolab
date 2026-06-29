// ──── FILE: src/types/class.ts ────
import { ProblemDifficulty } from "@/types/difficulties";
import { Language } from "@/types/languages";

export interface Question {
  id: string;
  title: string;
  description: string;
  tags: string[];
  difficulty: ProblemDifficulty;
  language: Language[];
}

export interface QusetionDetail extends Question {
  type: string, // General, Checker. 이 부분도 타입화를 해야 할지도??
  limit_time: number,
  limit_memory: number,
  template_codes: Array<{
    language: Language;
    files: Array<{ filename: string; content: string }>;
  }>; // 문제 템플릿 정보
}

export interface ExamQuestion{
  id: string;
  problem_id: string;
  title: string;
  language: Language[];
  points: number;
}

export interface ClassProblem {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  isExam: boolean;
  checked?: boolean;
}

export interface HomeworkProblem extends ClassProblem{
  problem_id: string;
  points: number;
  solveState?: "solved" | "wrong" | "none";
  language?: number[];
  attemptCount?: number;
  firstCorrectAttemptCount?: number | null;
  allAttemptCount?: number;
  allFirstCorrectAttemptCount?: number | null;
}

export interface ExamProblem extends ClassProblem{
  subQuestions: ExamQuestion[];
}
