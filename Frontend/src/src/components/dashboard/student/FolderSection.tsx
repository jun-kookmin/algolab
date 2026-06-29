'use client';

import Image from 'next/image';
import React from 'react';

export interface FolderItem {
    title: string;
    subtitle: string;
    type: 'current' | 'past';
}
interface Props { items: FolderItem[]; }

export default function FolderSection({ items }: Props) {
    return (
        <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-x-24 gap-y-16 w-full max-w-[960px] py-32">
                {items.map(({ title, subtitle, type }, idx) => {
                    const defaultSrc =
                        type === 'current'
                            ? '/assets/icon/Icon_Folder(current).svg'
                            : '/assets/icon/Icon_Folder(previous).svg';

                    return (
                        <div key={idx} className="flex flex-col items-center cursor-pointer group">
                            {/* 폴더 아이콘 */}
                            <div className="relative w-40 aspect-[6/5]">
                                <Image src={defaultSrc} alt="" fill className="object-contain group-hover:hidden" />
                                <Image src="/assets/icon/Icon_Folder(hover).svg" alt="" fill className="object-contain hidden group-hover:block" />
                            </div>
                            {/* 제목 / 부제목 */}
                            <span className="font-kr mt-5 font-semibold text-center truncate w-40">{title}</span>
                            <span className="font-eng text-gray-500 text-sm text-center mt-1 truncate w-40">{subtitle}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}