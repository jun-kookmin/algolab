// src/components/community/PostEditor.tsx
"use client";

import React, { useEffect, useState } from "react";
import DeleteModal from "@/components/class/DeleteModal";
import MarkdownEditor, {
    MarkdownEditorProps,
} from "@/components/markdown/MarkdownEditor";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";

type PostEditorProps = {
    // 저장 버튼 클릭 시 실행할 콜백 (실제 저장/라우팅은 TODO)
    onSubmit?: (data: { title: string; content: string; is_noticed?: boolean }) => void;
    // 새 글 작성 시 사용할 템플릿 종류
    contentTemplate: MarkdownEditorProps["role"];
    // 수정 모드일 때 사용할 초기 제목/내용
    initialTitle?: string;
    initialContent?: string;
    initialIsNoticed?: boolean;
};

export const PostEditor: React.FC<PostEditorProps> = ({
    onSubmit,
    contentTemplate,
    initialTitle = null,
    initialContent = null,
    initialIsNoticed = false,
}) => {
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const { me } = useAuth();
    const viewerGroup = (me?.group ?? "").toLowerCase();
    const canNotice =
        viewerGroup === "administrator" ||
        viewerGroup === "professor" ||
        viewerGroup === "instructor";
    const [isNoticed, setIsNoticed] = useState<boolean>(false);

    // 간단한 유효성 검사
    const isTitleEmpty = title.trim() === "";
    const isContentEmpty = content.trim() === "";
    const isSubmitDisabled = isTitleEmpty || isContentEmpty;

    // 수정 모드: 초기 제목 세팅
    useEffect(() => {
        if (initialTitle != null) {
            setTitle(initialTitle);
        }
    }, [initialTitle]);

    // 수정 모드: 초기 내용 세팅
    useEffect(() => {
        if (initialContent != null) {
            setContent(initialContent);
        }
    }, [initialContent]);

    useEffect(() => {
        if (canNotice) {
            setIsNoticed(Boolean(initialIsNoticed));
        } else {
            setIsNoticed(false);
        }
    }, [canNotice, initialIsNoticed]);

    const handleSave = () => {
        if (isSubmitDisabled) return;
        if (onSubmit) {
            const payload = {
                title: title.trim(),
                content: content.trim(),
                ...(canNotice ? { is_noticed: isNoticed } : {}),
            };
            onSubmit(payload);
        }
    };

    const clearData = () => {
        setTitle("");
        setContent("");
    };

    const actionBtnBase =
        "font-kr inline-flex h-9 w-24 items-center justify-center rounded-[10px] border text-xs font-medium transition-colors active:scale-95";
    const clearBtnClass =
        `${actionBtnBase} border-red-300 bg-white text-red-500 hover:bg-red-50`;
    const saveBtnClass =
        `${actionBtnBase} border-[rgba(78,97,246,1)] bg-[rgba(78,97,246,1)] text-white hover:bg-[rgba(55,69,175,1)] disabled:cursor-not-allowed disabled:border-indigo-300 disabled:bg-indigo-300 disabled:active:scale-100`;

    return (
        <div className="font-kr">
            {/* 제목 입력 */}
            <div className="mb-6">
                <label className="block text-gray-700 mb-1">게시글 제목</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="제목을 입력하세요"
                    className="w-full border-2 border-gray-300 rounded px-3 py-2"
                />
                {isTitleEmpty && (
                    <p className="text-xs text-gray-400 mt-1 ml-[2px]">
                        제목을 작성해 주세요
                    </p>
                )}
            </div>

            {/* 공지 설정 */}
            {canNotice && (
                <div className="mb-4 flex items-center gap-2">
                    <input
                        id="post-notice-toggle"
                        type="checkbox"
                        checked={isNoticed}
                        onChange={(e) => setIsNoticed(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="post-notice-toggle" className="text-sm text-gray-700">
                        공지로 등록
                    </label>
                </div>
            )}

            {/* 내용 입력 */}
            <div className="mb-6">
                <label className="block text-gray-700 mb-1">내용</label>
                <MarkdownEditor
                    value={content}
                    onChange={(val) => setContent(val ?? "")}
                    initialContent={initialContent ?? undefined}
                    role={contentTemplate}
                />
                {isContentEmpty && (
                    <p className="text-xs text-gray-400 mt-1 ml-[2px]">
                        내용을 작성해 주세요
                    </p>
                )}
            </div>

            {/* 버튼 영역 */}
            <div className="flex justify-end gap-2 mt-4">
                <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className={clearBtnClass}
                >
                    내용 지우기
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitDisabled}
                    className={saveBtnClass}
                >
                    저장하기
                </button>
            </div>

            {/* 내용 삭제 모달 */}
            <DeleteModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={() => {
                    clearData();
                    setDeleteModalOpen(false);
                }}
            />
        </div>
    );
};
