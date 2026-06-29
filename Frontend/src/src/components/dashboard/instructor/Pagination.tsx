'use client';

import Image from 'next/image';
import React from 'react';

interface Props {
    page: number;
    total: number;
    onChange: (p: number) => void;
    className?: string;
}

export default function Pagination({ page, total, onChange, className = "" }: Props) {
    return (
        <div className={`flex items-center justify-center gap-2 ${className}`}>
            <button className="p-2 disabled:opacity-30" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="이전">
                <Image src="/assets/icon/Icon_LeftArrow.svg" alt="" width={16} height={16} />
            </button>

            {Array.from({ length: total }).map((_, i) => {
                const p = i + 1;
                return (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        className={`w-8 h-8 text-sm rounded-md border ${
                            p === page
                                ? "bg-indigo-50 text-indigo-700 border-indigo-500 shadow-sm ring-1 ring-indigo-200 font-semibold"
                                : "text-gray-700 border-transparent hover:bg-primary-50"
                        }`}
                    >
                        {p}
                    </button>
                );
            })}

            <button className="p-2 disabled:opacity-30" onClick={() => onChange(page + 1)} disabled={page === total} aria-label="다음">
                <Image src="/assets/icon/Icon_RightArrow.svg" alt="" width={16} height={16} />
            </button>
        </div>
    );
}
