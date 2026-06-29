// ──── FILE: src/components/PdfViewer.tsx ────
"use client";

import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import Image from "next/image";

// PDF worker 설정(Next.js의 public 폴더에서 불러온다고 가정)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// 아이콘 이미지 경로
const ICON_PLUS = "/assets/icon/Icon_Plus.svg";
const ICON_MINUS = "/assets/icon/Icon_Minus.svg";

interface PdfViewerProps {
    file: string;
    minScale?: number; // 최소 줌 배율
    maxScale?: number; // 최대 줌 배율
    step?: number;     // 배율 조정 단계
}

const PdfViewer: React.FC<PdfViewerProps> = ({
    file,
    minScale = 1,
    maxScale = 3,
    step = 0.25,
}) => {
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [userScale, setUserScale] = useState(1);

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // 전역 에러 핸들러: ResizeObserver loop 에러 무시
    useEffect(() => {
        const oldOnError = window.onerror;
        window.onerror = (message, source, lineno, colno, error) => {
            if (
                typeof message === "string" &&
                message.includes("ResizeObserver loop completed")
            ) {
                return true; // 에러 무시
            }
            if (oldOnError) {
                return oldOnError(message, source, lineno, colno, error);
            }
            return false;
        };
        return () => {
            window.onerror = oldOnError;
        };
    }, []);

    // 컨테이너 폭 동적 추적
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    const goToPrevPage = () => setPageNumber((p) => Math.max(1, p - 1));
    const goToNextPage = () => setPageNumber((p) => Math.min(numPages, p + 1));
    const zoomIn = () => setUserScale((s) => Math.min(maxScale, s + step));
    const zoomOut = () => setUserScale((s) => Math.max(minScale, s - step));

    // 렌더링 폭 = 컨테이너 폭 × userScale
    const renderWidth = containerWidth * userScale;

    return (
        <div className="h-full flex flex-col min-h-0 p-2">
            {/* 페이지 렌더러 컨테이너 */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto bg-transparent rounded"
            >
                <div className="flex justify-center items-center mb-2 space-x-2">
                    <button onClick={zoomIn} className="bg-gray-300 rounded p-1">
                        <Image src={ICON_PLUS} alt="Plus" width={12} height={12} />
                    </button>
                    <span className="font-eng text-sm text-white">
                        {(userScale * 100).toFixed(0)}%
                    </span>
                    <button onClick={zoomOut} className="bg-gray-300 rounded p-1">
                        <Image src={ICON_MINUS} alt="Minus" width={12} height={12} />
                    </button>
                </div>
                <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
                    <Page pageNumber={pageNumber} width={renderWidth} />
                </Document>
            </div>

            {/* 페이지 이동 컨트롤 */}
            <div className="flex justify-center mt-4 items-center space-x-4">
                <button
                    onClick={goToPrevPage}
                    className="font-kr px-[12px] py-[8px] text-xs bg-gray-600 rounded-[8px] hover:bg-gray-700"
                >
                    이전
                </button>
                <span className="font-eng text-sm">
                    {pageNumber} / {numPages}
                </span>
                <button
                    onClick={goToNextPage}
                    className="font-kr px-[12px] py-[8px] text-xs bg-gray-600 rounded-[8px] hover:bg-gray-700"
                >
                    다음
                </button>
            </div>
        </div>
    );
};

export default PdfViewer;
