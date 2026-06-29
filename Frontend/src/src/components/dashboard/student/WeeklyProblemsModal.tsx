'use client';

import React, { useCallback, useEffect, useRef } from 'react';

export interface ProblemRow { id: number; lecture: string; title: string; deadline: string; link?: string; }

interface Props { open: boolean; onClose: () => void; rows: ProblemRow[]; }

export default function WeeklyProblemsModal({ open, onClose, rows }: Props) {
    const escHandler = useCallback(
      (e: KeyboardEvent) => e.key === "Escape" && onClose(),
      [onClose]
    );
    useEffect(
      () => {
        if (open) window.addEventListener("keydown", escHandler);
        return () => window.removeEventListener("keydown", escHandler);
      },
      [open, escHandler]
    );

    const firstRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => { if (open && firstRef.current) firstRef.current.focus(); }, [open]);

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            <div
                className={`fixed bottom-0 left-1/2 z-50 w-[clamp(320px,58vw,820px)] max-w-[92%] -translate-x-1/2 transform-gpu transition-transform duration-300 ${open ? '-translate-y-0' : 'translate-y-full'
                    }`}
                role="dialog" aria-modal="true"
            >
                <div className="bg-white rounded-t-3xl shadow-xl flex max-h-[calc(100dvh-1rem)] flex-col">
                    <div className="flex items-center justify-between border-b px-[clamp(16px,1.8vw,32px)] py-[clamp(14px,1.6vh,24px)]">
                        <h2 className="font-kr text-[clamp(1.3rem,2vw,1.875rem)] font-extrabold">이번주 풀어야 할 문제</h2>
                        <button ref={firstRef} onClick={onClose}
                            className="text-[clamp(1.4rem,2vw,1.875rem)] leading-none transition-transform hover:rotate-90" aria-label="닫기">×</button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-[clamp(16px,1.8vw,32px)] py-[clamp(14px,1.6vh,24px)]">
                        <table className="w-full text-left font-kr">
                            <thead className="text-gray-500 border-b">
                                <tr className="whitespace-nowrap">
                                    <th className="py-2 w-16">순번</th><th className="py-2 w-48">수업</th><th className="py-2">과제명</th>
                                    <th className="py-2 w-48 text-center">마감</th><th className="py-2 w-24 text-center">바로가기</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, idx) => (
                                    <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                        <td className="py-3">{idx + 1}</td>
                                        <td className="py-3">{r.lecture}</td>
                                        <td className="py-3">{r.title}</td>
                                        <td className={`py-3 text-center ${r.deadline.startsWith('D+') ? 'text-rose-400' : 'text-rose-700'}`}>{r.deadline}</td>
                                        <td className="py-3 text-center">
                                            {r.link ? <a href={r.link} className="inline-block transition-transform hover:scale-110">→</a> : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
