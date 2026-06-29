// src/components/markdown/MarkdownViewer.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import rehypeRaw from "rehype-raw";
import rehypeSafeHtml from "@/components/markdown/rehypeSafeHtml";

// SSR에서 오류 방지용 (클라이언트 전용으로 사용)
const MarkdownPreview = dynamic(
    () => import("@uiw/react-markdown-preview"),
    { ssr: false }
);

interface MarkdownViewerProps {
    // 마크다운 원본 문자열
    content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
    return (
        <div
            className="prose max-w-none text-sm text-gray-800"
            data-color-mode="light" // 다크모드 사용 시 변경 가능
        >
            <MarkdownPreview
                source={content}
                rehypePlugins={[rehypeRaw, rehypeSafeHtml]}
                skipHtml={false}
            />
        </div>
    );
};
