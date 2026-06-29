// ──── FILE: src/components/solve/exam/SolveComponentLeft.tsx ────
"use client";

import React, { useMemo } from "react";
import VditorPreview from "@/components/markdown/VditorPreview";
import CopyInputPanel from "@/components/solve/CopyInputPanel";
import { extractProblemCopyInputBlocks } from "@/utils/problemCopyInputBlocks";

interface SolveComponentLeftProps {
    markdownContent?: string;
}

const SolveComponentLeft: React.FC<SolveComponentLeftProps> = ({ markdownContent }) => {
    const parsed = useMemo(
        () => extractProblemCopyInputBlocks(markdownContent),
        [markdownContent],
    );
    const hasBody = parsed.markdownBody.trim().length > 0;

    return (
        <div className="w-full h-full flex flex-col min-h-0 overflow-auto">
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-auto rounded bg-gray-800">
                {hasBody ? (
                    <VditorPreview content={parsed.markdownBody} theme="dark" />
                ) : (
                    <div className="p-6 text-sm text-gray-400">문제 설명이 없습니다.</div>
                )}
            </div>
            {parsed.copyCases.length > 0 && (
                <CopyInputPanel copyCases={parsed.copyCases} theme="dark" />
            )}
        </div>
    );
};

export default SolveComponentLeft;
