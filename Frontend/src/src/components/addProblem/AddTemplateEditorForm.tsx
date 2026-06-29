// ──── FILE: src/components/AddTemplateEditorForm.tsx ────
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import MonacoEditor from "@/components/editor/MonacoEditor";
import type { TemplateFile, Lang } from "@/types/problemCreation";
import Image from "next/image";

/* 아이콘 경로 선언 */
const ICON_C = "/assets/icon/Icon_C.svg";
const ICON_CPP = "/assets/icon/Icon_CPP.svg";
const ICON_JAVA = "/assets/icon/Icon_Java.svg";
const ICON_PYTHON = "/assets/icon/Icon_Python.svg";

/* constants */
const LANG_ORDER = ["c", "cpp", "java", "python"] as const;
const ICON_MAP = { c: ICON_C, cpp: ICON_CPP, java: ICON_JAVA, python: ICON_PYTHON } as const;

/* base style */
const badgeBase =
    "flex items-center justify-center px-[4px] py-[2px] rounded-[4px] border border-gray-200 transition active:scale-95";


export interface AddTemplateEditorFormProps {
    selectedLangs: Lang[];

    /** ✅ Partial 로 변경 */
    templateCodes: Partial<Record<Lang, TemplateFile[]>>;

    setTemplateCodes: React.Dispatch<
        React.SetStateAction<Partial<Record<Lang, TemplateFile[]>>>
    >;
}

const AddTemplateEditorForm: React.FC<AddTemplateEditorFormProps> = ({
    selectedLangs,
    templateCodes,
    setTemplateCodes,
}) => {
    const firstSelected = LANG_ORDER.find((l) => selectedLangs.includes(l));
    const [lang, setLang] = useState<Lang | "">(() => firstSelected ?? "");
    const [fileIdx, setFileIdx] = useState(0);

    useEffect(() => {
        if (!selectedLangs.length) return;
        setLang((prev) => {
            if (prev && selectedLangs.includes(prev)) return prev;
            setFileIdx(0);
            return (LANG_ORDER.find((l) => selectedLangs.includes(l)) ?? "") as Lang;
        });
    }, [selectedLangs]);

    const files = useMemo<TemplateFile[]>(
        () => (lang ? templateCodes[lang] ?? [] : []),
        [templateCodes, lang]
    );

    const updateCode = useCallback(
        (code: string) => {
            if (!lang) return;
            const arr = [...files];
            arr[fileIdx] = { ...arr[fileIdx], code };
            setTemplateCodes({ ...templateCodes, [lang]: arr });
        },
        [files, fileIdx, lang, setTemplateCodes, templateCodes]
    );

    if (!lang) {
        return <p className="text-gray-400">왼쪽에서 언어를 선택하세요.</p>;
    }

    const file = files[fileIdx] ?? files[0];

    return (
        <div className="flex flex-col w-full h-full py-2 min-h-0">
            {/* 탭 & 뱃지 */}
            <div className="flex flex-wrap items-center gap-4 mb-2">
                {/* 파일 탭 */}
                <div className="flex gap-2">
                    {files.map((f, i) => (
                        <button
                            key={f.filename}
                            onClick={() => setFileIdx(i)}
                            aria-pressed={i === fileIdx}
                            className={`text-sm font-eng transition pb-0.5 ${i === fileIdx
                                ? "text-white border-b border-b-gray-200"
                                : "text-gray-400 hover:text-gray-200"
                                }`}
                        >
                            {f.filename}
                        </button>
                    ))}
                </div>

                {/* 언어 뱃지 */}
                <div className="ml-auto flex gap-2">
                    {LANG_ORDER.filter((l) => selectedLangs.includes(l)).map((l) => {
                        const iconPath = ICON_MAP[l];
                        const active = l === lang;
                        return (
                            <button
                                key={l}
                                onClick={() => {
                                    setLang(l);
                                    setFileIdx(0);
                                }}
                                aria-pressed={active}
                                className={`${badgeBase} ${active
                                    ? "bg-indigo-600 text-white border-indigo-600 ring-1 ring-indigo-400"
                                    : "bg-gray-700 text-gray-300 hover:border-gray-400"
                                    }`}
                            >
                                <Image src={iconPath} alt={l} width={0} height={16} className="w-auto" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 min-h-0 border border-gray-700 rounded-[16px] overflow-hidden">
                <MonacoEditor
                    key={`${lang}-${fileIdx}`}
                    language={lang}
                    initialCode={file?.code ?? ""}
                    onCodeChange={updateCode}
                    width="100%"
                    height="100%"
                />
            </div>
        </div>
    );
};

export default React.memo(AddTemplateEditorForm);
