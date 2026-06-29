"use client";

import React, { FormEvent, useState, ChangeEvent, useRef } from "react";
import Image from "next/image";
import type { FirstStepProps } from "@/types/problemCreation";
import {
    estimateDataUrlBytes,
    estimateImageRefBytes,
    formatByteCount,
    getNextImageAlias,
    migrateInlineBase64Images,
    pruneUnusedImageRefs,
} from "@/utils/problemMarkdownImageRefs";
import {
    buildCopyCaseBlockTemplate,
    extractProblemCopyInputBlocks,
} from "@/utils/problemCopyInputBlocks";

/* 아이콘 경로 선언 */
const ICON_RIGHT = "/assets/icon/Icon_Right.svg";
const DIFFICULTY_OPTIONS = [
    { value: "EASY", label: "쉬움" },
    { value: "MEDIUM", label: "보통" },
    { value: "HARD", label: "어려움" },
] as const;

const MAX_MANAGED_IMAGE_COUNT = 12;
const MAX_RAW_IMAGE_FILE_BYTES = 3 * 1024 * 1024;
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_INLINE_IMAGE_BYTES = 20 * 1024 * 1024;

const difficultyActiveClass = (value: typeof DIFFICULTY_OPTIONS[number]["value"]) => {
    switch (value) {
        case "EASY":
            return "border-green-600 bg-green-50 text-green-700";
        case "MEDIUM":
            return "border-orange-500 bg-orange-50 text-orange-700";
        case "HARD":
            return "border-red-600 bg-red-50 text-red-700";
        default:
            return "border-indigo-600 bg-indigo-50 text-indigo-700";
    }
};

/* presentation helpers */
const commonInput =
    "border-2 border-[rgba(200,206,252,1)] rounded-md px-3 py-2 text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500";
const IMAGE_REF_TOKEN_PATTERN = /!\[[^\]]*]\[[^\]]*]/g;
const MAX_EMBED_IMAGE_DIMENSION = 1000;
const LOSSY_IMAGE_QUALITY = 0.75;

type OptimizedImageResult = {
    dataUrl: string;
    resized: boolean;
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
};

const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
                return;
            }
            reject(new Error("Base64 변환에 실패했습니다."));
        };
        reader.onerror = () => reject(new Error("파일 읽기에 실패했습니다."));
        reader.readAsDataURL(file);
    });

const loadImageElement = (dataUrl: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("이미지 로드에 실패했습니다."));
        img.src = dataUrl;
    });

const normalizeImageMimeType = (fileType: string) => {
    if (fileType === "image/jpg") return "image/jpeg";
    if (fileType.startsWith("image/")) return fileType;
    return "image/jpeg";
};

const optimizeImageForEmbedding = async (
    file: File,
): Promise<OptimizedImageResult> => {
    const rawDataUrl = await readFileAsDataUrl(file);
    const image = await loadImageElement(rawDataUrl);

    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    const base = Math.max(originalWidth, originalHeight);

    if (!base || base <= MAX_EMBED_IMAGE_DIMENSION) {
        return {
            dataUrl: rawDataUrl,
            resized: false,
            originalWidth,
            originalHeight,
            width: originalWidth,
            height: originalHeight,
        };
    }

    const ratio = MAX_EMBED_IMAGE_DIMENSION / base;
    const width = Math.max(1, Math.round(originalWidth * ratio));
    const height = Math.max(1, Math.round(originalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return {
            dataUrl: rawDataUrl,
            resized: false,
            originalWidth,
            originalHeight,
            width: originalWidth,
            height: originalHeight,
        };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    const mimeType = normalizeImageMimeType(file.type);
    const isLossy = mimeType === "image/jpeg" || mimeType === "image/webp";
    const optimizedDataUrl = canvas.toDataURL(
        mimeType,
        isLossy ? LOSSY_IMAGE_QUALITY : undefined,
    );

    return {
        dataUrl: optimizedDataUrl,
        resized: true,
        originalWidth,
        originalHeight,
        width,
        height,
    };
};

const clampTableSize = (value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.min(10, Math.max(1, Math.floor(value)));
};

const buildMarkdownTable = (rows: number, cols: number) => {
    const safeRows = clampTableSize(rows);
    const safeCols = clampTableSize(cols);
    const header = Array.from({ length: safeCols }, (_, idx) => `Column ${idx + 1}`);
    const separator = Array.from({ length: safeCols }, () => "---");
    const emptyDataRow = Array.from({ length: safeCols }, () => " ");
    const body = Array.from({ length: safeRows }, () => `| ${emptyDataRow.join(" | ")} |`);
    return [`| ${header.join(" | ")} |`, `| ${separator.join(" | ")} |`, ...body].join("\n");
};

interface LimitFieldProps {
    label: string;
    value: number;
    onChange: (n: number) => void;
}

const LimitField: React.FC<LimitFieldProps> = ({ label, value, onChange }) => (
    <div className="flex items-center gap-2">
        <span className="w-24 text-sm">{label}</span>
        <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={`flex-1 ${commonInput}`}
        />
    </div>
);

const removeImageTokensByRange = (text: string, start: number, end: number) => {
    const ranges: Array<{ start: number; end: number }> = [];

    for (const match of text.matchAll(IMAGE_REF_TOKEN_PATTERN)) {
        const tokenStart = match.index ?? -1;
        if (tokenStart < 0) continue;
        const tokenEnd = tokenStart + match[0].length;
        const intersects = Math.max(start, tokenStart) < Math.min(end, tokenEnd);
        if (intersects) {
            ranges.push({ start: tokenStart, end: tokenEnd });
        }
    }

    if (!ranges.length) return null;

    let next = text;
    for (let i = ranges.length - 1; i >= 0; i -= 1) {
        const range = ranges[i];
        next = next.slice(0, range.start) + next.slice(range.end);
    }
    return next;
};

const AddProblemFirstStep: React.FC<FirstStepProps> = ({
    problemTitle,
    setProblemTitle,
    descriptionMd,
    setDescriptionMd,
    descriptionImageRefs,
    setDescriptionImageRefs,
    usePdf,
    setUsePdf,
    handlePdfUpload,
    share,
    setShare,
    difficulty,
    setDifficulty,
    timeLimit,
    setTimeLimit,
    memoryLimit,
    setMemoryLimit,
    breadcrumbActionLabel,
    breadcrumbTitle,
    onCancel,
    onNext,
}) => {
    const [base64Message, setBase64Message] = useState<string | null>(null);
    const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [tableRows, setTableRows] = useState(2);
    const [tableCols, setTableCols] = useState(2);
    const managedImageCount = Object.keys(descriptionImageRefs).length;
    const totalImageBytes = estimateImageRefBytes(descriptionImageRefs);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onNext();
    };

    const onImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setBase64Message("이미지 파일만 Base64 변환이 가능합니다.");
            e.target.value = "";
            return;
        }

        if (managedImageCount >= MAX_MANAGED_IMAGE_COUNT) {
            setBase64Message(
                `이미지는 최대 ${MAX_MANAGED_IMAGE_COUNT}개까지만 임베드할 수 있습니다. 기존 이미지를 삭제한 뒤 추가해 주세요.`,
            );
            e.target.value = "";
            return;
        }

        if (file.size > MAX_RAW_IMAGE_FILE_BYTES) {
            setBase64Message(
                `이미지 용량이 큽니다. 현재 ${formatByteCount(file.size)} 입니다. ` +
                `하나당 최대 ${formatByteCount(MAX_RAW_IMAGE_FILE_BYTES)} 이하만 허용됩니다.`,
            );
            e.target.value = "";
            return;
        }

        try {
            const target = descriptionTextareaRef.current;
            const insertStart = target?.selectionStart ?? descriptionMd.length;
            const insertEnd = target?.selectionEnd ?? insertStart;

            const optimized = await optimizeImageForEmbedding(file);
            const inlineBytes = estimateDataUrlBytes(optimized.dataUrl);

            if (inlineBytes > MAX_INLINE_IMAGE_BYTES) {
                setBase64Message(
                    `현재 처리 결과 이미지가 너무 큽니다 (${formatByteCount(inlineBytes)}). ` +
                    `최대 ${formatByteCount(MAX_INLINE_IMAGE_BYTES)} 이하만 허용됩니다.`,
                );
                e.target.value = "";
                return;
            }

            const nextAlias = getNextImageAlias(descriptionMd, descriptionImageRefs);
            const nextImageBytes = estimateImageRefBytes({
                ...descriptionImageRefs,
                [nextAlias]: optimized.dataUrl,
            });

            if (nextImageBytes > MAX_TOTAL_INLINE_IMAGE_BYTES) {
                setBase64Message(
                    `전체 이미지 본문 용량이 ${formatByteCount(nextImageBytes)}로 과도합니다. ` +
                    `최대 ${formatByteCount(MAX_TOTAL_INLINE_IMAGE_BYTES)} 이하로 맞춰 주세요.`,
                );
                e.target.value = "";
                return;
            }

            const alias = getNextImageAlias(descriptionMd, descriptionImageRefs);
            const imageUseLine = `![${alias}][${alias}]`;
            const before = descriptionMd.slice(0, insertStart);
            const after = descriptionMd.slice(insertEnd);
            const nextBody = `${before}${imageUseLine}${after}`;

            setDescriptionMd(nextBody);
            setDescriptionImageRefs((prev) => ({
                ...prev,
                [alias]: optimized.dataUrl,
            }));
            const nextCursor = insertStart + imageUseLine.length;
            requestAnimationFrame(() => {
                const textarea = descriptionTextareaRef.current;
                if (!textarea) return;
                textarea.focus();
                textarea.selectionStart = nextCursor;
                textarea.selectionEnd = nextCursor;
            });
            if (optimized.resized) {
                setBase64Message(
                    `${file.name} 이미지가 ${alias}로 추가되었습니다. (${optimized.originalWidth}x${optimized.originalHeight} → ${optimized.width}x${optimized.height})`,
                );
            } else {
                setBase64Message(`${file.name} 이미지가 ${alias} 참조로 추가되었습니다.`);
            }
        } catch {
            setBase64Message("이미지 Base64 변환 중 오류가 발생했습니다.");
        } finally {
            e.target.value = "";
        }
    };

    const normalizeInlineBase64Images = () => {
        const result = migrateInlineBase64Images(descriptionMd, descriptionImageRefs);

        if (result.convertedCount === 0) {
            setBase64Message("정리할 inline Base64 이미지가 없습니다.");
            return;
        }

        setDescriptionMd(result.body);
        setDescriptionImageRefs(result.imageRefs);
        setBase64Message(
            `기존 inline Base64 이미지 ${result.convertedCount}개를 참조 형식으로 정리했습니다.`,
        );
    };

    const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const nextBody = e.target.value;
        setDescriptionMd(nextBody);
        setDescriptionImageRefs((prev) => {
            if (Object.keys(prev).length === 0) {
                return prev;
            }
            return pruneUnusedImageRefs(nextBody, prev);
        });
    };

    const insertMarkdownTableAtCursor = () => {
        const markdownTable = buildMarkdownTable(tableRows, tableCols);
        const target = descriptionTextareaRef.current;
        if (!target) {
            const suffix = descriptionMd.endsWith("\n") || descriptionMd.length === 0 ? "" : "\n";
            setDescriptionMd(`${descriptionMd}${suffix}${markdownTable}`);
            return;
        }

        const start = target.selectionStart ?? descriptionMd.length;
        const end = target.selectionEnd ?? start;
        const before = descriptionMd.slice(0, start);
        const after = descriptionMd.slice(end);

        const needsLeadingNewLine = before.length > 0 && !before.endsWith("\n");
        const needsTrailingNewLine = after.length > 0 && !after.startsWith("\n");
        const inserted = `${needsLeadingNewLine ? "\n" : ""}${markdownTable}${needsTrailingNewLine ? "\n" : ""}`;
        const nextBody = `${before}${inserted}${after}`;

        setDescriptionMd(nextBody);

        const firstHeaderStart =
            before.length + (needsLeadingNewLine ? 1 : 0) + inserted.indexOf("Column 1");
        requestAnimationFrame(() => {
            target.focus();
            target.selectionStart = firstHeaderStart;
            target.selectionEnd = firstHeaderStart + "Column 1".length;
        });
    };

    const insertCopyInputBlockAtCursor = () => {
        const { copyCases } = extractProblemCopyInputBlocks(descriptionMd);
        const blockSnippet = buildCopyCaseBlockTemplate(`테스트케이스 ${copyCases.length + 1}`);
        const target = descriptionTextareaRef.current;
        if (!target) {
            const suffix = descriptionMd.endsWith("\n") || descriptionMd.length === 0 ? "" : "\n\n";
            setDescriptionMd(`${descriptionMd}${suffix}${blockSnippet}`);
            return;
        }

        const start = target.selectionStart ?? descriptionMd.length;
        const end = target.selectionEnd ?? start;
        const before = descriptionMd.slice(0, start);
        const after = descriptionMd.slice(end);

        const needsLeadingNewLine = before.length > 0 && !before.endsWith("\n");
        const needsTrailingNewLine = after.length > 0 && !after.startsWith("\n");
        const inserted = `${needsLeadingNewLine ? "\n\n" : ""}${blockSnippet}${needsTrailingNewLine ? "\n\n" : ""}`;
        const nextBody = `${before}${inserted}${after}`;

        setDescriptionMd(nextBody);
    };

    const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== "Backspace" && e.key !== "Delete") {
            return;
        }

        const target = e.currentTarget;
        const selectionStart = target.selectionStart ?? 0;
        const selectionEnd = target.selectionEnd ?? selectionStart;

        const rangeStart =
            selectionStart === selectionEnd && e.key === "Backspace"
                ? Math.max(0, selectionStart - 1)
                : selectionStart;
        const rangeEnd =
            selectionStart === selectionEnd && e.key === "Delete"
                ? Math.min(descriptionMd.length, selectionEnd + 1)
                : selectionEnd;

        if (rangeStart === rangeEnd) {
            return;
        }

        const nextBody = removeImageTokensByRange(descriptionMd, rangeStart, rangeEnd);
        if (nextBody === null) {
            return;
        }

        e.preventDefault();
        setDescriptionMd(nextBody);
        setDescriptionImageRefs((prev) => pruneUnusedImageRefs(nextBody, prev));

        const nextCursor = Math.min(rangeStart, nextBody.length);
        requestAnimationFrame(() => {
            target.selectionStart = nextCursor;
            target.selectionEnd = nextCursor;
        });
    };

    const actionLabel = breadcrumbActionLabel?.trim() || "문제 만들기";
    const titleLabel = breadcrumbTitle?.trim() || "";

    return (
        <form
            onSubmit={handleSubmit}
            className="w-full lg:w-1/2 h-full overflow-auto flex flex-col gap-6 bg-white"
        >
            {/* 헤더 */}
            <header className="flex items-center font-kr px-8 pt-2 pb-1 border-b border-b-gray-200 text-xs shadow">
                <span className="font-kr font-light">문제</span>
                <Image src={ICON_RIGHT} alt="Right" width={12} height={12} />
                <span className="font-kr font-medium">{actionLabel}</span>
                {titleLabel ? (
                    <>
                        <Image src={ICON_RIGHT} alt="Right" width={12} height={12} />
                        <span className="font-kr font-medium truncate">{titleLabel}</span>
                    </>
                ) : null}
            </header>

            <section className="flex flex-col h-full px-8 py-6 mb-4 space-y-6">
                {/* 제목 */}
                <div className="flex flex-col">
                    <label className="font-kr font-medium">문제 제목</label>
                    <input
                        type="text"
                        placeholder="과제 제목을 입력하세요"
                        value={problemTitle}
                        onChange={(e) => setProblemTitle(e.target.value)}
                        className={commonInput}
                    />
                </div>

                {/* 본문 */}
                <div className="flex flex-col">
                    <label className="font-kr font-medium">문제 본문</label>
                    <textarea
                        ref={descriptionTextareaRef}
                        rows={15}
                        placeholder="문제 설명을 마크다운으로 작성해 주세요"
                        value={descriptionMd}
                        onChange={handleDescriptionChange}
                        onKeyDown={handleDescriptionKeyDown}
                        className={`${commonInput} resize-none`}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                        <input
                            id="description-image-base64"
                            type="file"
                            accept="image/*"
                            onChange={onImageFileChange}
                            className="hidden"
                        />
                        <label
                            htmlFor="description-image-base64"
                            className="w-fit cursor-pointer rounded-md border border-indigo-500 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                        >
                            이미지 선택
                        </label>
                        <button
                            type="button"
                            onClick={normalizeInlineBase64Images}
                            className="w-fit rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            기존 Base64 정리
                        </button>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                            <span>행</span>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={tableRows}
                                onChange={(e) => setTableRows(clampTableSize(Number(e.target.value)))}
                                className="w-14 rounded border border-gray-300 px-1 py-1 text-xs"
                            />
                            <span>열</span>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={tableCols}
                                onChange={(e) => setTableCols(clampTableSize(Number(e.target.value)))}
                                className="w-14 rounded border border-gray-300 px-1 py-1 text-xs"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={insertMarkdownTableAtCursor}
                            className="w-fit rounded-md border border-emerald-400 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                            표 추가
                        </button>
                        <button
                            type="button"
                            onClick={insertCopyInputBlockAtCursor}
                            className="w-fit rounded-md border border-blue-400 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
                        >
                            입출력 블록 추가
                        </button>
                    </div>
                    {managedImageCount > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                            관리 중인 이미지 Base64: {managedImageCount}개 (에디터에서 직접 수정 불가)
                        </p>
                    )}
                    {totalImageBytes > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                            예상 이미지 본문 용량: {formatByteCount(totalImageBytes)}
                        </p>
                    )}
                    {base64Message && <p className="mt-2 text-xs text-gray-500">{base64Message}</p>}
                </div>

                {/* PDF 설정 */}
                {/* <div className="flex flex-col gap-3 py-4 border-y-2 border-[rgba(200,206,252,1)]">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={usePdf}
                            onChange={() => {
                                setUsePdf(!usePdf);
                                if (usePdf) setPdfName(null);
                            }}
                        />
                        <span className="font-kr text-sm">PDF로 문제 제공</span>
                    </label>

                    <div className="flex items-center">
                        <input
                            type="file"
                            id="file-upload"
                            onChange={onPdfChange}
                            accept="application/pdf"
                            className="hidden"
                        />

                        <label
                            htmlFor="file-upload"
                            className={`cursor-pointer rounded-md px-4 py-2 text-sm text-white ${usePdf ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-400 cursor-not-allowed"
                                }`}
                            aria-disabled={!usePdf}
                            onClick={(e) => {
                                if (!usePdf) e.preventDefault();
                            }}
                        >
                            파일 찾기
                        </label>

                        <span
                            className="ml-3 text-sm text-gray-600 truncate max-w-[60%]"
                            title={pdfName ?? undefined}
                        >
                            {pdfName ?? "선택된 파일 없음"}
                        </span>
                    </div>
                </div> */}

                {/* 난이도 */}
                <fieldset className="py-4 border-b-2 border-[rgba(200,206,252,1)]">
                    <legend className="font-kr font-medium">난이도</legend>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        {DIFFICULTY_OPTIONS.map((opt) => {
                            const active = difficulty === opt.value;
                            return (
                                <label
                                    key={opt.value}
                                    className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors ${
                                        active
                                            ? difficultyActiveClass(opt.value)
                                            : "border-gray-200 text-gray-500 hover:border-indigo-300"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="difficulty"
                                        value={opt.value}
                                        checked={active}
                                        onChange={() => setDifficulty(opt.value)}
                                        className="sr-only"
                                    />
                                    {opt.label}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                {/* 공유 설정 */}
                <fieldset className="py-4 border-b-2 border-[rgba(200,206,252,1)]">
                    <legend className="font-kr font-medium">공유 여부 설정</legend>
                    <label className="mt-2 inline-flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={share}
                            onChange={(e) => setShare(e.target.checked)}
                        />
                        <span>문제 공유 여부 (체크를 한 경우 문제 관리 페이지에서 공유되며 체크를 하지 않은 경우 해당 계정에서만 볼 수 있습니다.)</span>
                    </label>
                </fieldset>

                {/* 제한값 */}
                <fieldset className="py-4 border-b-2 border-[rgba(200,206,252,1)]">
                    <legend className="font-kr font-medium">제한 설정</legend>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <LimitField label="시간 제한 (ms)" value={timeLimit} onChange={setTimeLimit} />
                        <LimitField label="메모리 제한 (MB)" value={memoryLimit} onChange={setMemoryLimit} />
                    </div>
                </fieldset>

                {/* 액션 버튼 */}
                <div className="flex justify-end gap-4 mt-auto pb-10">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="font-kr text-xs px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        className="font-kr text-xs px-6 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        다음
                    </button>
                </div>
            </section>
        </form>
    );
};

export default AddProblemFirstStep;
