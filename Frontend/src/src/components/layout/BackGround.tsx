"use client";

import React, { ReactNode } from 'react';
import { usePathname } from "next/navigation";

interface Props {
    children?: ReactNode;
}

const BackGround: React.FC<Props> = ({ children }) => {
    const pathname = usePathname();
    const isSolvePage = pathname?.includes("/solve/") ?? false;
    const isSubmissionPage =
        pathname?.startsWith("/mysubmission") ||
        pathname?.startsWith("/submission/") ||
        false;
    const isClassManagePage = pathname?.includes("/classmanage") ?? false;
    const isProblemEditorPage =
        pathname?.startsWith("/problem/add") ||
        /^\/problem\/[^/]+\/edit(?:\/)?$/.test(pathname ?? "");

    if (isSolvePage) {
        return (
            <div className="fixed inset-0 -z-10 pointer-events-none">
                <div
                    className="w-full h-full bg-cover bg-center"
                    style={{ backgroundImage: "url(/BackGround.svg)" }}
                />
                {children ? <div className="absolute inset-0">{children}</div> : null}
            </div>
        );
    }

    if (isSubmissionPage || isClassManagePage || isProblemEditorPage) {
        return (
            <div className="fixed inset-0 -z-10 pointer-events-none bg-[rgba(237,239,254,1)]">
                {children ? <div className="absolute inset-0">{children}</div> : null}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 -z-10 pointer-events-none bg-white">
            {children ? <div className="absolute inset-0">{children}</div> : null}
        </div>
    );
};

export default BackGround;
