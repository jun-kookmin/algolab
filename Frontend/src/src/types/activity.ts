// ──── FILE: src/types/activity.ts ────
/** 공통으로 사용하는 Student, Task 타입 정의 */
export interface Student {
    id: number;
    name: string;
    studentId: string;
    progress: number; // 0 ~ 100
    memo?: string;
}

export interface Task {
    id: number;
    title: string;
    week: string;
    chapter: string;
    status: '미제출' | '제출';
    score?: string; // 과락, Pass 등 – 필요 시 확장
    color?: 'red' | 'green' | 'blue';
}
