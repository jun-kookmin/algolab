'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import WeeklyProblemsModal, { ProblemRow } from '@/components/dashboard/student/WeeklyProblemsModal';

interface Props { title: string; rows: ProblemRow[]; }

export default function WeeklyProblems({ title, rows }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {!open && (
                <div className="fixed inset-x-0 bottom-12 flex justify-center" onClick={() => setOpen(true)}>
                    <div className="group relative w-[clamp(320px,62vw,912px)] max-w-[92%] cursor-pointer">
                        <Image src="/assets/icon/Icon_Rectangle.svg" alt="" fill priority className="absolute inset-0 w-full h-auto z-30 -translate-y-5" />
                        <Image src="/assets/icon/Icon_Rectangle(overlay).svg" alt="" fill
                            className="absolute top-0 left-1/2 w-[90%] h-auto z-10 -translate-x-1/2 -translate-y-14 transition-opacity duration-200 group-hover:opacity-0" />
                        <Image src="/assets/icon/Icon_Rectangle(hover).svg" alt="" fill
                            className="absolute top-0 left-1/2 w-[90%] h-auto z-10 -translate-x-1/2 -translate-y-20 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-24" />
                        <div className="absolute inset-0 z-40 flex items-center px-[clamp(12px,1.2vw,20px)] py-[clamp(10px,1vh,14px)]">
                            <h3 className="font-kr text-[clamp(1.1rem,1.8vw,1.5rem)] font-bold text-white">{title}</h3>
                        </div>
                    </div>
                </div>
            )}

            <WeeklyProblemsModal open={open} onClose={() => setOpen(false)} rows={rows} />
        </>
    );
}
