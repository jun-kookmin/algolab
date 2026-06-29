import React from "react";
import { Answer } from "@/types/submit";

interface SubmitStatusProps {
  answers: Answer[];
  showFirstCorrectAttempts?: boolean;
}

/**
 * Answer 모델 예시
 * {
 *   questionNumber: number;
 *   status: '정답' | '오답' | '부분' | '미채점';
 *   attempts: number;         // 제출 횟수(추가)
 * }
 */
export default function SubmitStatus({
  answers,
  showFirstCorrectAttempts = false,
}: SubmitStatusProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {answers.map((ans) => {
        // 원 색상 결정
        let circleColor = "bg-gray-400"; // 미채점 기본
        if (ans.status === "정답") circleColor = "bg-green-600";
        else if (ans.status === "오답") circleColor = "bg-red-600";
        else if (ans.status === "지각") circleColor = "bg-gray-300";

        return (
          <div
            key={ans.questionNumber}
            className="flex flex-col items-center"
            title={`문항 ${ans.questionNumber} : ${ans.status}`}
          >
            <div className={`w-5 h-5 rounded-full ${circleColor}`} />
            {showFirstCorrectAttempts ? (
              <div className="mt-0.5 text-center text-[10px] leading-none text-gray-600">
                <div>
                  정{" "}
                  {typeof ans.firstCorrectAttempts === "number" &&
                  ans.firstCorrectAttempts > 0
                    ? ans.firstCorrectAttempts
                    : "-"}
                </div>
                <div className="mt-0.5">총 {ans.attempts ?? 0}</div>
              </div>
            ) : (
              <span className="mt-0.5 text-[10px] leading-none text-gray-600">
                {ans.attempts ?? 0}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
