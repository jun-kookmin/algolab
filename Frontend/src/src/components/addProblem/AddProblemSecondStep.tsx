"use client";

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type {
    SecondStepProps,
    TemplateFile,
    ProblemType,
    CheckerLang,
} from "@/types/problemCreation";
import {
    isLockedPrimaryTemplate,
} from "@/utils/problemTemplateRules";

/* 아이콘 경로 선언 */
const ICON_RIGHT = "/assets/icon/Icon_Right.svg";
const ICON_C = "/assets/icon/Icon_C.svg";
const ICON_CPP = "/assets/icon/Icon_CPP.svg";
const ICON_JAVA = "/assets/icon/Icon_Java.svg";
const ICON_PYTHON = "/assets/icon/Icon_Python.svg";
const ICON_TRASH = "/assets/icon/Icon_TrashCan.svg";
const ICON_PLUS = "/assets/icon/Icon_Plus.svg";

/* template meta */
export const TEMPLATE_META = {
    c: {
        filename: "main.c",
        code: `#include <stdio.h>\n\nint main(void)\n{\n    return 0;\n}`,
    },
    cpp: {
        filename: "main.cpp",
        code: `#include <iostream>\n\nint main()\n{\n    return 0;\n}`,
    },
    java: {
        filename: "Main.java",
        code: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  public static void main(String[] args) throws Exception {\n  }\n}`,
    },
    python: {
        filename: "main.py",
        code: `import sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()`,
    },
} as const;

type TemplateLang = keyof typeof TEMPLATE_META;

const LANG_META = [
    { id: "c", label: "C", iconPath: ICON_C },
    { id: "cpp", label: "C++", iconPath: ICON_CPP },
    { id: "java", label: "Java", iconPath: ICON_JAVA },
    { id: "python", label: "Python", iconPath: ICON_PYTHON },
] as const;

const INPUT_EXT = ".in";
// .output, .out 둘 다 허용
const OUTPUT_EXTS = [".output", ".out"] as const;

const getBaseName = (filename: string) =>
    filename.replace(/\.(in|out|output)$/i, "");

const naturalSort = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const sortFilesByName = (files: File[]) =>
    [...files].sort((a, b) => naturalSort(a.name, b.name));

const extractCaseIndex = (filename: string) => {
    const base = getBaseName(filename).trim();
    if (/^\d+$/.test(base)) return Number(base);

    const nums = base.match(/\d+/g);
    if (!nums?.length) return 0;

    return Math.max(...nums.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
};

const upsertCaseFile = (
    files: File[] | null,
    filename: string,
    content: string,
) => {
    const next = files ? [...files] : [];
    const idx = next.findIndex((f) => f.name === filename);
    const updated = new File([content], filename, { type: "text/plain" });

    if (idx >= 0) {
        next[idx] = updated;
    } else {
        next.push(updated);
    }
    return sortFilesByName(next);
};

const defaultTemplate = (lang: TemplateLang): TemplateFile => ({
    ...TEMPLATE_META[lang],
});

const AddProblemSecondStep: React.FC<SecondStepProps> = ({
    problemType,
    setProblemType,
    inputFiles,
    setInputFiles,
    outputFiles,
    setOutputFiles,
    checkerCode,
    setCheckerCode,
    checkerLang,
    setCheckerLang,
    selectedLangs,
    setSelectedLangs,
    templateCodes,
    setTemplateCodes,
    breadcrumbActionLabel,
    breadcrumbTitle,
    onBack,
    onCancel,
    isSubmitting = false,
    onSubmit,
}) => {
    const actionLabel = breadcrumbActionLabel?.trim() || "문제 만들기";
    const titleLabel = breadcrumbTitle?.trim() || "";

    const pairedCaseRows = useMemo(() => {
        const inByBase = new Map<string, File>();
        const outByBase = new Map<string, File>();

        (inputFiles ?? []).forEach((f) => {
            inByBase.set(getBaseName(f.name), f);
        });
        (outputFiles ?? []).forEach((f) => {
            outByBase.set(getBaseName(f.name), f);
        });

        const bases = Array.from(
            new Set([...inByBase.keys(), ...outByBase.keys()]),
        ).sort(naturalSort);

        return bases.map((base) => ({
            base,
            inputFile: inByBase.get(base) ?? null,
            outputFile: outByBase.get(base) ?? null,
            inputName: inByBase.get(base)?.name ?? "",
            outputName: outByBase.get(base)?.name ?? "",
        }));
    }, [inputFiles, outputFiles]);

    const [selectedCaseBase, setSelectedCaseBase] = useState<string | null>(null);
    const [inputContent, setInputContent] = useState("");
    const [outputContent, setOutputContent] = useState("");
    const [loadingCaseContent, setLoadingCaseContent] = useState(false);

    useEffect(() => {
        if (!pairedCaseRows.length) {
            setSelectedCaseBase(null);
            setInputContent("");
            setOutputContent("");
            return;
        }

        if (!selectedCaseBase || !pairedCaseRows.some((r) => r.base === selectedCaseBase)) {
            setSelectedCaseBase(pairedCaseRows[0].base);
        }
    }, [pairedCaseRows, selectedCaseBase]);

    const selectedCaseRow = useMemo(
        () => pairedCaseRows.find((r) => r.base === selectedCaseBase) ?? null,
        [pairedCaseRows, selectedCaseBase],
    );
    const selectedCaseInputFile = selectedCaseRow?.inputFile ?? null;
    const selectedCaseOutputFile = selectedCaseRow?.outputFile ?? null;
    const selectedCaseInputName = selectedCaseRow?.inputName ?? "";
    const selectedCaseOutputName = selectedCaseRow?.outputName ?? "";

    useEffect(() => {
        if (!selectedCaseRow) {
            setInputContent("");
            setOutputContent("");
            setLoadingCaseContent(false);
            return;
        }

        let cancelled = false;
        setLoadingCaseContent(true);

        (async () => {
            const [inText, outText] = await Promise.all([
                selectedCaseRow.inputFile ? selectedCaseRow.inputFile.text() : Promise.resolve(""),
                selectedCaseRow.outputFile ? selectedCaseRow.outputFile.text() : Promise.resolve(""),
            ]);
            if (cancelled) return;
            setInputContent(inText);
            setOutputContent(outText);
            setLoadingCaseContent(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [selectedCaseBase, selectedCaseInputName, selectedCaseOutputName]);

    // 언어 토글: 켤 때 main.xxx 1개 생성, 끌 때 해당 언어 템플릿 제거
    const toggleLang = (lang: CheckerLang) => {
        const isSelected = selectedLangs.includes(lang);
        if (isSelected) {
            setSelectedLangs((prev) => prev.filter((l) => l !== lang) as CheckerLang[]);
            setTemplateCodes((prev) => {
                const next = { ...prev };
                delete next[lang];
                return next;
            });
        } else {
            setSelectedLangs((prev) => [...prev, lang] as CheckerLang[]);
            setTemplateCodes((prev) => ({
                ...prev,
                [lang]: [defaultTemplate(lang as TemplateLang)],
            }));
        }
    };

    // 파일명 변경
    const renameFile = (lang: CheckerLang, idx: number, filename: string) => {
        if (isLockedPrimaryTemplate(lang, idx)) {
            return;
        }
        setTemplateCodes((prev) => {
            const base = prev[lang] ?? [defaultTemplate(lang as TemplateLang)];
            const arr = [...base];
            arr[idx] = { ...arr[idx], filename };
            return { ...prev, [lang]: arr };
        });
    };

    // 파일 추가
    const addFile = (lang: CheckerLang) => {
        setTemplateCodes((prev) => {
            const base = prev[lang] ?? [defaultTemplate(lang as TemplateLang)];
            const arr = [...base];
            const ext =
                lang === "java" ? ".java" :
                    lang === "python" ? ".py" :
                        lang === "c" ? ".c" : ".cpp";

            arr.push({
                filename: `file${arr.length + 1}${ext}`,
                code: defaultTemplate(lang as TemplateLang).code,
            });
            return { ...prev, [lang]: arr };
        });
    };

    // 파일 삭제 (마지막 1개도 삭제 가능: 삭제 후 해당 언어 자동 해제)
    const deleteFile = (lang: CheckerLang, idx: number) => {
        if (isLockedPrimaryTemplate(lang, idx)) {
            return;
        }
        const arr = templateCodes[lang] ?? [];
        const next = arr.filter((_, i) => i !== idx);

        if (next.length === 0) {
            // 마지막 파일을 지우면 언어도 자동 해제
            setSelectedLangs((prev) => prev.filter((l) => l !== lang) as CheckerLang[]);
            const nextCodes = { ...templateCodes };
            delete nextCodes[lang];
            setTemplateCodes(nextCodes);
        } else {
            setTemplateCodes({ ...templateCodes, [lang]: next });
        }
    };

    // 폴더 업로드 (브라우저별 속성 호환)
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const dirAttr = { directory: "", webkitdirectory: "", mozdirectory: "" } as unknown;

    const applyCaseFiles = (list: FileList | null) => {
        if (!list) {
            setInputFiles(null);
            setOutputFiles(null);
            setSelectedCaseBase(null);
            return;
        }
        const all = Array.from(list);

        // 대소문자 무시하고 필터링
        const ins = all.filter((f) => f.name.toLowerCase().endsWith(INPUT_EXT));
        const outs = all.filter((f) => {
            const n = f.name.toLowerCase();
            return OUTPUT_EXTS.some((ext) => n.endsWith(ext));
        });

        setInputFiles(ins.length ? ins : null);
        setOutputFiles(outs.length ? outs : null);
        setSelectedCaseBase(null);

        // 무엇이 잡혔는지 디버깅 로그
        console.groupCollapsed("%c[Folder] 선택 결과", "color:#9c6");
        // console.log("총 파일:", all.length);
        // console.log("입력(*.in):", ins.map((f) => f.name));
        // console.log("출력(*.out|*.output):", outs.map((f) => f.name));
        console.groupEnd();
    };

    const handleCaseFolder = (e: ChangeEvent<HTMLInputElement>) => {
        applyCaseFiles(e.target.files);
    };

    const openFolderPicker = () => {
        if (!folderInputRef.current) return;
        folderInputRef.current.value = "";
        folderInputRef.current.click();
    };

    const openFilePicker = () => {
        if (!fileInputRef.current) return;
        fileInputRef.current.value = "";
        fileInputRef.current.click();
    };

    const addTestcasePair = () => {
        const existingInputNames = new Set((inputFiles ?? []).map((f) => f.name.toLowerCase()));
        const existingOutputNames = new Set((outputFiles ?? []).map((f) => f.name.toLowerCase()));
        const allFiles = [...(inputFiles ?? []), ...(outputFiles ?? [])];

        let nextIndex = allFiles.reduce((max, file) => {
            const idx = extractCaseIndex(file.name);
            return Math.max(max, idx);
        }, 0) + 1;

        while (
            existingInputNames.has(`${nextIndex}.in`) ||
            existingOutputNames.has(`${nextIndex}.out`) ||
            existingOutputNames.has(`${nextIndex}.output`)
        ) {
            nextIndex += 1;
        }

        const inName = `${nextIndex}.in`;
        const outName = `${nextIndex}.out`;
        const nextInputFiles = sortFilesByName([...(inputFiles ?? []), new File([""], inName, { type: "text/plain" })]);
        const nextOutputFiles = sortFilesByName([...(outputFiles ?? []), new File([""], outName, { type: "text/plain" })]);

        setInputFiles(nextInputFiles);
        setOutputFiles(nextOutputFiles);
        setSelectedCaseBase(String(nextIndex));
    };

    const persistInputContent = (content: string) => {
        if (!selectedCaseRow) return;
        const filename = selectedCaseRow.inputName || `${selectedCaseRow.base}.in`;
        const nextFiles = upsertCaseFile(inputFiles, filename, content);
        setInputFiles(nextFiles);
    };

    const persistOutputContent = (content: string) => {
        if (!selectedCaseRow) return;
        const filename = selectedCaseRow.outputName || `${selectedCaseRow.base}.out`;
        const nextFiles = upsertCaseFile(outputFiles, filename, content);
        setOutputFiles(nextFiles);
    };

    const onInputContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const next = e.target.value;
        setInputContent(next);
        persistInputContent(next);
    };

    const onOutputContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const next = e.target.value;
        setOutputContent(next);
        persistOutputContent(next);
    };

    const deleteSelectedTestcasePair = () => {
        if (!selectedCaseRow) return;

        const targetBase = selectedCaseRow.base;
        const nextInputFiles = (inputFiles ?? []).filter(
            (file) => getBaseName(file.name) !== targetBase,
        );
        const nextOutputFiles = (outputFiles ?? []).filter(
            (file) => getBaseName(file.name) !== targetBase,
        );

        setInputFiles(nextInputFiles.length ? sortFilesByName(nextInputFiles) : null);
        setOutputFiles(nextOutputFiles.length ? sortFilesByName(nextOutputFiles) : null);
        setSelectedCaseBase(null);
    };

    return (
        <form
            onSubmit={(e) => {
                if (isSubmitting) {
                    e.preventDefault();
                    return;
                }
                onSubmit(e);
            }}
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

            <div className="px-8 py-6 flex flex-col h-full mb-4 space-y-6">
                {/* 채점 타입 */}
                <section className="border-b-2 border-indigo-200 pb-4 space-y-4">
                    <label className="font-kr font-medium">채점 타입</label>
                    <div className="grid grid-cols-2 gap-5">
                        {(["general", "checker"] as ProblemType[]).map((id) => (
                            <label key={id}>
                                <input
                                    type="radio"
                                    name="ptype"
                                    className="peer sr-only"
                                    value={id}
                                    checked={problemType === id}
                                    onChange={() => setProblemType(id)}
                                />
                                <div className="text-center px-4 py-2 border border-gray-200 rounded-md peer-checked:bg-indigo-600 peer-checked:text-white">
                                    {id === "general" ? "General" : "Checker"}
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* checker code editor */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm">
                            채점 코드 언어
                            <select
                                value={checkerLang}
                                onChange={(e) => setCheckerLang(e.target.value as CheckerLang)}
                                disabled={problemType !== "checker"}
                                className="border border-gray-200 px-2 py-1 rounded-md disabled:opacity-50"
                            >
                                {LANG_META.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <textarea
                            className={`h-64 p-2 text-xs font-mono border border-gray-200 rounded-md resize-none ${problemType !== "checker" &&
                                "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                            placeholder="// Checker 타입을 선택하면 편집할 수 있습니다"
                            value={checkerCode}
                            onChange={(e) => setCheckerCode(e.target.value)}
                            readOnly={problemType !== "checker"}
                        />
                    </div>
                </section>

                {/* 허용 언어 & 템플릿 */}
                <section className="border-b-2 border-indigo-200 pb-4 space-y-2">
                    <label className="font-kr font-medium">허용 언어 &amp; 템플릿</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                        {LANG_META.map(({ id, label, iconPath }) => {
                            const selected = selectedLangs.includes(id as CheckerLang);
                            const files = templateCodes[id as CheckerLang] ?? [];
                            return (
                                <div key={id} className="flex flex-col gap-2">
                                    {/* language checkbox */}
                                    <label>
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={selected}
                                            onChange={() => toggleLang(id as CheckerLang)}
                                        />
                                        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md text-sm peer-checked:bg-indigo-600 peer-checked:text-white">
                                            <Image src={iconPath} alt={label} width={16} height={16} />
                                            <span>{label}</span>
                                        </div>
                                    </label>

                                    {/* template filenames */}
                                    {selected &&
                                        files.map((f, i) => (
                                            <div key={i} className="flex items-center gap-1">
                                                <input
                                                    value={f.filename}
                                                    onChange={(e) =>
                                                        renameFile(id as CheckerLang, i, e.target.value)
                                                    }
                                                    disabled={isLockedPrimaryTemplate(id as CheckerLang, i)}
                                                    className={`flex-1 text-xs px-1 py-0.5 border border-gray-200 rounded-md ${
                                                        isLockedPrimaryTemplate(id as CheckerLang, i)
                                                            ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                                            : ""
                                                    }`}
                                                    title={
                                                        isLockedPrimaryTemplate(id as CheckerLang, i)
                                                            ? "첫 템플릿 파일명은 고정됩니다."
                                                            : undefined
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => deleteFile(id as CheckerLang, i)}
                                                    disabled={isLockedPrimaryTemplate(id as CheckerLang, i)}
                                                    title={
                                                        isLockedPrimaryTemplate(id as CheckerLang, i)
                                                            ? "첫 템플릿 파일은 삭제할 수 없습니다. 언어를 해제하면 함께 제거됩니다."
                                                            : "파일 삭제"
                                                    }
                                                >
                                                    <Image src={ICON_TRASH} alt="Delete" width={16} height={16} />
                                                </button>
                                            </div>
                                        ))}

                                    {selected && (
                                        <button
                                            type="button"
                                            onClick={() => addFile(id as CheckerLang)}
                                            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                                        >
                                            <Image src={ICON_PLUS} alt="Plus" width={12} height={12} />
                                            파일 추가
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p className="flex justify-end text-[11px] text-gray-400">
                        기본 템플릿 코드가 제공 됩니다.
                    </p>
                </section>

                {/* 테스트 케이스 폴더 업로드 */}
                <section className="flex flex-col border-b-2 border-indigo-200 py-4 space-y-2">
                    <label className="font-kr font-medium">테스트 케이스 폴더 업로드</label>

                    {/* 1) 실제 input: 숨김 */}
                    <input
                        // @ts-expect-error - non-standard directory attributes
                        {...dirAttr}
                        ref={folderInputRef}
                        type="file"
                        id="folder-upload"
                        multiple
                        onChange={handleCaseFolder}
                        className="hidden"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        id="case-file-upload"
                        multiple
                        accept={`${INPUT_EXT},.output,.out`}
                        onChange={handleCaseFolder}
                        className="hidden"
                    />

                    {/* 2) 액션 버튼 */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={openFolderPicker}
                            className="inline-block cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 w-fit"
                        >
                            폴더 선택
                        </button>
                        <button
                            type="button"
                            onClick={openFilePicker}
                            className="rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
                        >
                            파일 선택(대체)
                        </button>
                        <button
                            type="button"
                            onClick={addTestcasePair}
                            className="rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
                        >
                            테스트케이스 추가
                        </button>
                        <button
                            type="button"
                            onClick={deleteSelectedTestcasePair}
                            disabled={!selectedCaseRow}
                            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            선택 케이스 삭제
                        </button>
                    </div>

                    {(inputFiles || outputFiles) && (
                        <p className="text-xs text-gray-500">
                            입력 {inputFiles ? inputFiles.length : 0} / 출력{" "}
                            {outputFiles ? outputFiles.length : 0}
                        </p>
                    )}

                    {pairedCaseRows.length > 0 && (
                        <div className="rounded-md border border-gray-200">
                            <div className="grid grid-cols-2 border-b border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-600">
                                <div className="px-3 py-2">입력 파일 (.in)</div>
                                <div className="border-l border-gray-200 px-3 py-2">
                                    출력 파일 (.out / .output)
                                </div>
                            </div>
                            <div className="max-h-56 overflow-auto text-xs">
                                {pairedCaseRows.map((row) => (
                                    <div
                                        key={row.base}
                                        className={`grid cursor-pointer grid-cols-2 border-b border-gray-100 last:border-0 ${
                                            row.base === selectedCaseBase ? "bg-indigo-50" : "hover:bg-gray-50"
                                        }`}
                                        onClick={() => setSelectedCaseBase(row.base)}
                                    >
                                        <div className="truncate px-3 py-2 text-gray-700" title={row.inputName}>
                                            {row.inputName || "-"}
                                        </div>
                                        <div
                                            className="truncate border-l border-gray-100 px-3 py-2 text-gray-700"
                                            title={row.outputName}
                                        >
                                            {row.outputName || "-"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedCaseRow && (
                        <div className="space-y-2 rounded-md border border-gray-200 p-3">
                            <div className="text-xs font-medium text-gray-600">
                                케이스 편집: <span className="text-gray-800">{selectedCaseRow.base}</span>
                            </div>
                            {loadingCaseContent ? (
                                <p className="text-xs text-gray-500">파일 내용을 불러오는 중...</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] text-gray-500">
                                            입력 ({selectedCaseRow.inputName || `${selectedCaseRow.base}.in`})
                                        </label>
                                        <textarea
                                            value={inputContent}
                                            onChange={onInputContentChange}
                                            className="h-40 resize-none rounded-md border border-gray-200 p-2 font-mono text-xs"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] text-gray-500">
                                            출력 ({selectedCaseRow.outputName || `${selectedCaseRow.base}.out`})
                                        </label>
                                        <textarea
                                            value={outputContent}
                                            onChange={onOutputContentChange}
                                            className="h-40 resize-none rounded-md border border-gray-200 p-2 font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-[11px] text-gray-400">
                        선택한 폴더 안의 <code>*.in</code>, <code>*.output</code> 또는{" "}
                        <code>*.out</code> 파일을 자동 분류합니다.
                    </p>
                </section>

                {/* actions */}
                <div className="mt-auto flex justify-end gap-4 pb-10 font-kr">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-xs px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-xs px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
                    >
                        이전
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="text-xs px-6 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? "저장 중..." : "저장"}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default AddProblemSecondStep;
