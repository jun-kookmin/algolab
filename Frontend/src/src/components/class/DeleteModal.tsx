// ──── FILE: src/components/DeleteModal.tsx ────
"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

const StarIcon: string = "/assets/icon/Icon_Star.svg";

interface DeleteModalProps {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ open, onConfirm, onClose }) => {
    // ESC 및 스크롤 잠금(+폭 보정)
    useEffect(() => {
        if (!open) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);

        const scrollbarWidth =
            window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        document.body.style.paddingRight = `${scrollbarWidth}px`;

        return () => {
            window.removeEventListener("keydown", handleEsc);
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"
            onMouseDown={onClose}
        >
            <div className="relative z-10 flex min-h-full items-start justify-center py-4 sm:items-center">
                <div
                    className="fluid-modal-sm relative flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto rounded-lg bg-white px-[clamp(16px,1.7vw,32px)] pb-[clamp(16px,1.8vh,32px)] pt-[clamp(14px,1.5vh,24px)] shadow-xl"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                {/* 아이콘 */}
                <div className="mb-4 flex justify-center">
                    <Image src={StarIcon} alt="" width={56} height={56} />
                </div>

                {/* 제목 */}
                <h2 className="font-kr fluid-title-md mb-2 text-center font-bold text-gray-900">
                    정말 삭제하시겠습니까?
                </h2>

                {/* 설명 */}
                <p className="font-kr mb-6 text-center text-sm leading-relaxed text-gray-500">
                    한번 삭제하면 복구할 수 없습니다.
                    <br />
                    신중하게 생각하고 삭제하세요
                </p>

                    {/* 액션 버튼 */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="font-kr fluid-control-h w-full rounded-[10px] border-2 border-[#EE443F] bg-white px-[clamp(14px,1.2vw,24px)] text-[clamp(12px,0.8vw,14px)] font-bold text-[#EE443F] transition-colors hover:bg-[#FDECEC] active:scale-95"
                    >
                        삭제하기
                    </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="font-kr fluid-control-h w-full rounded-[10px] border-2 border-indigo-500 bg-white px-[clamp(14px,1.2vw,24px)] text-[clamp(12px,0.8vw,14px)] font-bold text-indigo-600 hover:bg-indigo-50 active:scale-95"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DeleteModal;
