"use client";

import { useGetProblem } from "@/hooks/problems/useGetProblem";

type ProblemCommunityHeaderProps = {
    problemId: string;
    fallbackTitle?: string;
};

export function ProblemCommunityHeader({
    problemId,
    fallbackTitle,
}: ProblemCommunityHeaderProps) {
    const { data: problemData } = useGetProblem(problemId, {
        includeTestcases: false,
    });

    const resolvedTitle =
        problemData?.title?.trim() || fallbackTitle?.trim() || "";

    return (
        <h1 className="font-kr text-3xl font-semibold">
            {resolvedTitle ? `게시판 - ${resolvedTitle}` : "게시판"}
        </h1>
    );
}
