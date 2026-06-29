// ──── FILE: src/components/AssignmentStatus.tsx ────
"use client";

import React from "react";
import { ProblemStatus } from "@/types/testManage";

/** 상태별 색상 맵 */
const COLOR_MAP: Record<ProblemStatus, string> = {
    none: "bg-gray-300",
    correct: "bg-green-600",
    wrong: "bg-red-600",
};

/** 상태별 툴팁 맵 */
const TOOLTIP_MAP: Record<ProblemStatus, string> = {
    none: "풀이하지 않음",
    correct: "정답",
    wrong: "오답",
};

interface Props {
    /** 문제 순서대로 상태 배열 (length === 전체 문제 개수) */
    statuses: ProblemStatus[];
}

const AssignmentStatus: React.FC<Props> = ({ statuses }) => (
    <div className="flex items-center">
        {statuses.map((st, idx) => (
            <span
                key={idx}
                className={`w-3 h-3 rounded-full mx-1 ${COLOR_MAP[st]}`}
                title={TOOLTIP_MAP[st]}
            />
        ))}
    </div>
);

export default AssignmentStatus;
