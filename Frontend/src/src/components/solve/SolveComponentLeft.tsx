// ──── FILE: src/components/SolveComponentLeft.tsx ────
"use client";

import React, { useMemo } from "react";
import PdfViewer from "@/components/viewer/PDFViewer";
import VditorPreview from "@/components/markdown/VditorPreview";
import CopyInputPanel from "@/components/solve/CopyInputPanel";
import { extractProblemCopyInputBlocks } from "@/utils/problemCopyInputBlocks";

interface SolveComponentLeftProps {
    pdfFile: string;
    markdownContent?: string;
    isExam?: boolean;
}

const SolveComponentLeft: React.FC<SolveComponentLeftProps> = ({
    pdfFile,
    markdownContent,
    // isExam,
}) => {
    const parsed = useMemo(
        () => extractProblemCopyInputBlocks(markdownContent),
        [markdownContent],
    );

    return (
        <div className="w-full h-full flex flex-col min-h-0 overflow-auto">
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-auto rounded bg-gray-800">
                {markdownContent ? (
                    <VditorPreview content={parsed.markdownBody} />
                ) : (
                    <PdfViewer file={pdfFile} />
                )}
            </div>
            {markdownContent && parsed.copyCases.length > 0 && (
                <CopyInputPanel copyCases={parsed.copyCases} theme="dark" />
            )}
        </div>
    );
};

export default SolveComponentLeft;
