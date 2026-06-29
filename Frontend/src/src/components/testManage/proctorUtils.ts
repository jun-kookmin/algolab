// ──── FILE: src/components/testmanage/proctorUtils.ts ────
"use client";

import type {
  ExamSubmission,
  ExamProblem as ExamSubmissionProblem,
} from "@/hooks/problems/get/exam/useGetExamSubmissions";
import type { CompletedItem, ProblemStatus } from "@/types/testManage";
import { formatDisplayName } from "@/utils/name";

const CORRECT_STATUSES = new Set([
  "CORRECT",
  "AC",
  "SV",
  "SUCCESS",
  "SOLVED",
]);
const WRONG_STATUSES = new Set([
  "WRONG",
  "WA",
  "TLE",
  "MLE",
  "RE",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
  "CE",
  "ERROR",
  "FAILED",
  "FAIL",
]);

const normalizeStatus = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

const toProblemStatus = (submission?: ExamSubmissionProblem): ProblemStatus => {
  if (!submission) return "none";
  const status = normalizeStatus(submission.status);
  if (status && CORRECT_STATUSES.has(status)) return "correct";
  if (status && WRONG_STATUSES.has(status)) return "wrong";
  const scoreValue = Number(submission.score);
  if (Number.isFinite(scoreValue)) {
    return scoreValue >= 100 ? "correct" : "wrong";
  }
  return "none";
};

const formatTime = (value?: Date | null): string => {
  if (!value || Number.isNaN(value.getTime())) return "";
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  const ss = String(value.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

type ProctorGroups = {
  notStarted: CompletedItem[];
  inProgress: CompletedItem[];
  completed: CompletedItem[];
};

export const buildProctorGroups = (
  rows: ExamSubmission[],
  examProblemIds: string[],
  options?: { examFinished?: boolean }
): ProctorGroups => {
  const isExamFinished = options?.examFinished ?? false;
  const fallbackProblemIds =
    examProblemIds.length > 0
      ? examProblemIds
      : Array.from(
          new Set(
            rows
              .flatMap((r) => r.problems ?? [])
              .map((p) => String(p.section_problem_uuid ?? p.uuid ?? ""))
              .filter(Boolean)
          )
        );

  const notStarted: CompletedItem[] = [];
  const inProgress: CompletedItem[] = [];
  const completed: CompletedItem[] = [];

  rows.forEach((row) => {
    const submissions = row.problems ?? [];
    const latestByProblem = new Map<string, ExamSubmissionProblem>();
    let earliestTime: number | null = null;
    let latestTime: number | null = null;
    let latestIp = "";

    submissions.forEach((sub) => {
      const problemId = String(
        sub.section_problem_uuid ?? sub.uuid ?? ""
      ).trim();
      const timeValue = new Date(sub.submission_time || "").getTime();
      const hasValidTime = Number.isFinite(timeValue);

      if (problemId) {
        const prev = latestByProblem.get(problemId);
        const prevTime = prev
          ? new Date(prev.submission_time || "").getTime()
          : -Infinity;
        if (!prev || (hasValidTime && timeValue >= prevTime)) {
          latestByProblem.set(problemId, sub);
        }
      }

      if (hasValidTime) {
        if (earliestTime === null || timeValue < earliestTime) {
          earliestTime = timeValue;
        }
        if (latestTime === null || timeValue > latestTime) {
          latestTime = timeValue;
          if (sub.ip) latestIp = sub.ip;
        }
      }
    });

    const statuses: ProblemStatus[] = fallbackProblemIds.map((pid) =>
      toProblemStatus(latestByProblem.get(pid))
    );

    const startedAt = row.start_time ? new Date(row.start_time).getTime() : null;
    const finishedAt = row.finished_at ? new Date(row.finished_at).getTime() : null;
    const isStarted = startedAt !== null && Number.isFinite(startedAt);
    const finishedByUser = !!row.finished_by_user;
    const isCompleted =
      finishedByUser ||
      (finishedAt !== null && Number.isFinite(finishedAt)) ||
      (isExamFinished && isStarted);

    const item: CompletedItem = {
      id: row.student_number ?? String(row.user_id),
      userId: String(row.user_id ?? ""),
      name: formatDisplayName(row.name ?? ""),
      statuses,
      ip: latestIp,
      finishedByUser,
      startTime:
        startedAt && Number.isFinite(startedAt)
          ? formatTime(new Date(startedAt))
          : earliestTime
          ? formatTime(new Date(earliestTime))
          : "",
      duration:
        isCompleted && finishedAt && Number.isFinite(finishedAt)
          ? formatTime(new Date(finishedAt))
          : isCompleted && latestTime
          ? formatTime(new Date(latestTime))
          : "",
    };

    if (!isStarted) {
      notStarted.push(item);
    } else if (isCompleted) {
      completed.push(item);
    } else {
      inProgress.push(item);
    }
  });

  return { notStarted, inProgress, completed };
};
