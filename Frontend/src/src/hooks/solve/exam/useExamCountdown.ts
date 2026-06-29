"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamStatusResponse } from "@/hooks/solve/exam/GET/useGetExamStatus";

interface ExamCountdownResult {
  remainingSeconds: number | null;
}

export const useExamCountdown = (
  examStatus?: ExamStatusResponse | null
): ExamCountdownResult => {
  const offsetRef = useRef(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    const raw = examStatus?.server_time;
    if (!raw) return;
    const serverMs = new Date(raw).getTime();
    if (!Number.isFinite(serverMs)) return;
    offsetRef.current = serverMs - Date.now();
  }, [examStatus?.server_time]);

  useEffect(() => {
    const dueRaw = examStatus?.due_date ?? null;
    if (!dueRaw) {
      if (typeof examStatus?.remaining_seconds === "number") {
        setRemainingSeconds(examStatus.remaining_seconds);
      }
      return;
    }
    const dueMs = new Date(dueRaw).getTime();
    if (!Number.isFinite(dueMs)) return;

    const tick = () => {
      const nowMs = Date.now() + offsetRef.current;
      const next = Math.max(0, Math.ceil((dueMs - nowMs) / 1000));
      setRemainingSeconds(next);
    };

    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [examStatus?.due_date, examStatus?.remaining_seconds]);

  return { remainingSeconds };
};
