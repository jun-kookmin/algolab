import type { ProblemDifficulty } from "@/types/difficulties";

export interface Problem {
    id: string;
    title: string;        // 문제 제목
    difficulty?: ProblemDifficulty;
    isExam: boolean;      // 시험 여부
    openDate: string;     // 공개일
    startDate: string;    // 시작일
    endDate: string;      // 종료일 (없으면 "—" 출력)
    canEdit?: boolean;
    makerName?: string;
  }
  
