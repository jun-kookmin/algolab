// ──── FILE: app/dashboard/instructor/CurriculumCard.tsx ────
'use client';

import Image from 'next/image';
import React from 'react';

interface Props {
    title: string;
    partCnt: number;
    problemCnt: number;
    term: string;
    /** 커리큘럼 수정 버튼 콜백 */
    onEdit: () => void;
    /** 학생관리 버튼 콜백 */
    onManage?: () => void;
    /** 삭제 버튼 콜백 */
    onDelete?: () => void;
    /** 커리큘럼 보기 버튼 콜백 */
    onView?: () => void;
}

export default function CurriculumCard({
    title,
    partCnt,
    problemCnt,
    term,
    onEdit,
    onManage,
    onDelete,
    onView, // 추가
}: Props) {
    const actionButtonBase =
        'font-kr fluid-control-h min-w-0 w-full whitespace-nowrap rounded-[10px] border bg-white px-[clamp(8px,0.7vw,12px)] text-[clamp(11px,0.72vw,13px)] font-medium leading-tight text-center transition-colors active:scale-95';

    return (
        <div className="relative w-full rounded-[clamp(8px,0.6vw,12px)] bg-white px-[clamp(16px,1.7vw,32px)] pt-[clamp(16px,1.7vw,32px)] ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_14px_rgba(15,23,42,0.04)]">
            {/* 우측 상단 삭제 버튼 */}
            <div className="flex justify-end">
                <button
                    onClick={onDelete}
                    aria-label="삭제"
                    className="group relative h-6 w-6"
                >
                    <Image
                        src="/assets/icon/Icon_TrashCan(Black).svg"
                        alt="휴지통"
                        width={24}
                        height={24}
                        className="absolute inset-0 h-6 w-6 opacity-60 transition-opacity group-hover:opacity-0"
                    />
                    <Image
                        src="/assets/icon/Icon_TrashCan(Red).svg"
                        alt="휴지통-빨강"
                        width={24}
                        height={24}
                        className="absolute inset-0 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                </button>
            </div>

            {/* 수업 정보 */}
            <h3 className="font-kr fluid-title-md mb-2 font-semibold">{title}</h3>
            <p className="text-sm text-gray-600 mb-1">
                {partCnt} 파트&nbsp;&nbsp;|&nbsp;&nbsp;{problemCnt} 문제
            </p>
            <p className="text-sm text-gray-600 mb-8">{term}</p>

            {/* 하단 버튼들 */}
            <div className="grid grid-cols-[0.72fr_1fr_1.25fr] gap-[clamp(8px,0.7vw,12px)] pb-[clamp(12px,1.4vh,16px)]">
                {/* 커리큘럼 수정 버튼 */}
                <button
                    onClick={onEdit}
                    className={`${actionButtonBase} border-sky-300 text-sky-600 hover:bg-sky-50`}
                >
                    수정
                </button>
                {/* 학생관리 버튼 */}
                <button
                    onClick={onManage}
                    className={`${actionButtonBase} border-blue-300 text-blue-600 hover:bg-blue-50`}
                >
                    학생관리
                </button>

                {/* 커리큘럼 보기 버튼 */}
                <button
                    onClick={onView} // onClick에 연결
                    className={`${actionButtonBase} border-indigo-300 text-indigo-600 hover:bg-indigo-50`}
                >
                    커리큘럼 보기
                </button>
            </div>
        </div>
    );
}
