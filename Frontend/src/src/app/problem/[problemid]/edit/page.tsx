// app/problem/[pid]/edit/page.tsx
"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type Dispatch,
    type FormEvent,
    type SetStateAction,
} from "react";

import AddProblemForm from "@/components/addProblem/AddProblemForm";
import AddTemplateEditorForm from "@/components/addProblem/AddTemplateEditorForm";
import SolveComponentLeft from "@/components/solve/SolveComponentLeft";

import { useGetProblem } from "@/hooks/problems/useGetProblem";
import { usePatchProblem, type PatchProblemBody } from "@/hooks/problems/patch/usePatchProblem";
import { mapLanguagesNum, toLanguageFromName, type Language } from "@/types/languages";
import {
    composeDescriptionWithImageRefs,
    splitDescriptionAndImageRefs,
    migrateInlineBase64Images,
} from "@/utils/problemMarkdownImageRefs";
import {
    buildTemplateCodePayload,
    normalizeTemplateCodeState,
    normalizeTemplateFilesForLanguage,
} from "@/utils/problemTemplateRules";

import type {
    WizardStep,
    Lang,
    ProblemType,
    TemplateFile,
} from "@/types/problemCreation";

/** 프론트에서 사용하는 언어 키 */
const ALL_LANGS: Lang[] = ["c", "cpp", "java", "python"];

/** 내부 정규화 타입 */
type NormalizedDetail = {
    title: string;
    description: string;
    type: "GENERAL" | "CHECKER";
    limit_time: number;
    limit_memory: number;
    difficulty?: "EASY" | "MEDIUM" | "HARD";
    checker_code: string | null;
    langs: Lang[];
    templates: Record<Lang, TemplateFile[]>;
    share: boolean;
};

/* ------------------------- 유틸: 비교/정규화/복제 ------------------------- */
const toSet = (arr: string[]) => new Set(arr);
const sameSet = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sa = toSet(a), sb = toSet(b);
    for (const x of sa) if (!sb.has(x)) return false;
    return true;
};

const deepCloneTemplates = (src: Record<Lang, TemplateFile[]>) => {
    const out: Record<Lang, TemplateFile[]> = {} as any;
    for (const l of ALL_LANGS) {
        const arr = src[l] ?? [];
        out[l] = arr.map(f => ({ filename: f.filename ?? "", code: f.code ?? "" }));
    }
    return out;
};

const canonTemplates = (src: Record<Lang, TemplateFile[]>) => {
    const out: Record<Lang, { filename: string; code: string }[]> = {} as any;
    for (const l of ALL_LANGS) {
        out[l] = (src[l] ?? [])
            .map(f => ({ filename: f.filename ?? "", code: f.code ?? "" }))
            .sort((a, b) => a.filename.localeCompare(b.filename));
    }
    return out;
};

const extractTestcaseIndex = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
    }
    return NaN;
};

type TestcasePayloadForEdit = {
    input?: {
        index?: unknown;
        content?: unknown;
    };
    output?: {
        index?: unknown;
        content?: unknown;
    };
};

type TestcasePayloadForPatch = {
    input?: {
        index: number;
        content: string;
    };
    output?: {
        index: number;
        content: string;
    };
};

const getCaseBase = (filename: string) =>
    filename.replace(/\.(in|out|output)$/i, "");

const naturalCompare = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const filesToTextMap = async (files: File[] | null) => {
    const map = new Map<string, string>();
    if (!files?.length) return map;

    await Promise.all(
        files.map(async (f) => {
            const name = getCaseBase(f.name);
            const text = await f.text();
            map.set(name, text);
        }),
    );
    return map;
};

const buildPatchTestcases = async (
    inputFiles: File[] | null,
    outputFiles: File[] | null,
    problemType: ProblemType,
): Promise<TestcasePayloadForPatch[]> => {
    const inMap = await filesToTextMap(inputFiles);
    const outMap = await filesToTextMap(outputFiles);
    const allNames = Array.from(new Set([...inMap.keys(), ...outMap.keys()])).sort(
        naturalCompare,
    );

    const testcases: TestcasePayloadForPatch[] = [];
    let nextIndex = 1;

    for (const name of allNames) {
        const inputText = inMap.get(name);
        const outputText = outMap.get(name);

        if (problemType === "checker") {
            if (inputText === undefined) continue;
            testcases.push({
                input: { index: nextIndex, content: inputText },
                ...(outputText !== undefined
                    ? { output: { index: nextIndex, content: outputText } }
                    : {}),
            });
            nextIndex += 1;
            continue;
        }

        if (inputText === undefined || outputText === undefined) continue;
        testcases.push({
            input: { index: nextIndex, content: inputText },
            output: { index: nextIndex, content: outputText },
        });
        nextIndex += 1;
    }

    return testcases;
};

const toTestCaseFiles = (
    testcases: TestcasePayloadForEdit[] | undefined | null
) => {
    const rows = Array.isArray(testcases) ? testcases : [];
    const normalized = rows
        .map((tc, order) => {
            const resolvedIndex = Math.max(
                1,
                extractTestcaseIndex(tc?.input?.index) || extractTestcaseIndex(tc?.output?.index) || order + 1
            );
            return { tc, resolvedIndex, order };
        })
        .sort((a, b) => {
            if (a.resolvedIndex !== b.resolvedIndex) return a.resolvedIndex - b.resolvedIndex;
            return a.order - b.order;
        });

    const inputFiles = normalized
        .map(({ tc, resolvedIndex }) => {
            if (!tc?.input || typeof tc.input.content !== "string") return null;
            return new File([tc.input.content], `${resolvedIndex}.in`, { type: "text/plain" });
        })
        .filter((f): f is File => f !== null);

    const outputFiles = normalized
        .map(({ tc, resolvedIndex }) => {
            if (!tc?.output || typeof tc.output.content !== "string") return null;
            return new File([tc.output.content], `${resolvedIndex}.out`, { type: "text/plain" });
        })
        .filter((f): f is File => f !== null);

    return {
        inputFiles,
        outputFiles,
    };
};

const templatesDiffer = (
    a: Record<Lang, TemplateFile[]>,
    b: Record<Lang, TemplateFile[]>
) => {
    const A = canonTemplates(a);
    const B = canonTemplates(b);
    for (const l of ALL_LANGS) {
        const aa = A[l];
        const bb = B[l];
        if (aa.length !== bb.length) return true;
        for (let i = 0; i < aa.length; i++) {
            if (aa[i].filename !== bb[i].filename) return true;
            if (aa[i].code !== bb[i].code) return true;
        }
    }
    return false;
};
/* ------------------------------------------------------------------------ */

const EditProblemPage: React.FC = () => {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const languageIndexesFromLangs = useCallback((langs: Lang[]) => {
    const ids = mapLanguagesNum(langs as Language[]);
    return ids;
  }, []);

    // pid robust 파싱: [pid] 또는 [problemid] 폴더 모두 지원 + pathname 백업
    const p = params as Record<string, string | string[] | undefined>;
    const rawParam = p?.pid ?? p?.problemid;
    const firstVal = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    const pidFromPath = (() => {
        const m = pathname?.match(/\/problem\/([^/]+)\/edit(?:\/|$)/);
        return m ? m[1] : undefined;
    })();
    const pid = typeof firstVal === "string" && firstVal.trim()
        ? firstVal
        : pidFromPath;

    useEffect(() => {
        // console.log("[Edit] params =", params, "pathname =", pathname, "pid =", pid);
    }, [params, pathname, pid]);

    const enabledPid = pid && pid.trim() ? pid : undefined;

    // 상세 GET
    const { data, isLoading, isError, error } = useGetProblem(enabledPid, {
        includeTestcases: true,
    });
    // PATCH
    const { mutateAsync: doPatch, isPending: patching } = usePatchProblem(enabledPid ?? "");

    // ------------------------------- 상태 -------------------------------
    // 1단계
    const [problemTitle, setProblemTitle] = useState("");
    const [descriptionMd, setDescriptionMd] = useState("");
    const [descriptionImageRefs, setDescriptionImageRefs] = useState<Record<string, string>>({});
    const [usePdf, setUsePdf] = useState(false);
    const [share, setShare] = useState(true);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [, setPdfFile] = useState<File | null>(null);
    const [timeLimit, setTimeLimit] = useState(100);
    const [memoryLimit, setMemoryLimit] = useState(128);
    const [selectedLangs, setSelectedLangs] = useState<Lang[]>([]);

    // 2단계
    const [problemType, setProblemType] = useState<ProblemType>("general");
    const [inputFiles, setInputFiles] = useState<File[] | null>(null);
    const [outputFiles, setOutputFiles] = useState<File[] | null>(null);
    const [checkerCode, setCheckerCode] = useState("// 채점용 코드를 작성하세요");
    const [checkerLang, setCheckerLang] = useState<Lang>("cpp");
    const [templateCodes, setTemplateCodes] = useState<Partial<Record<Lang, TemplateFile[]>>>({});
    const setTemplateCodesWithLock = useCallback<Dispatch<SetStateAction<Partial<Record<Lang, TemplateFile[]>>>>>((value) => {
        setTemplateCodes((prev) =>
            normalizeTemplateCodeState(
                typeof value === "function" ? value(prev) : value,
            ),
        );
    }, []);

    const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
    const [step, setStep] = useState<WizardStep>(1);
    const [previewDescriptionMd, setPreviewDescriptionMd] = useState("");

    // 원본 스냅샷
    const originalRef = useRef<NormalizedDetail | null>(null);

    const handlePdfUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPdfUrl(URL.createObjectURL(file));
            setPdfFile(file);
        } else {
            setPdfUrl(null);
            setPdfFile(null);
        }
    }, []);

    // 빈 키 보장
    const filledTemplateCodes = useMemo<Record<Lang, TemplateFile[]>>(
        () =>
            ALL_LANGS.reduce((acc, lang) => {
                acc[lang] = templateCodes[lang] ?? [];
                return acc;
            }, {} as Record<Lang, TemplateFile[]>),
        [templateCodes]
    );

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setPreviewDescriptionMd(
                composeDescriptionWithImageRefs(descriptionMd, descriptionImageRefs, {
                    pruneUnused: true,
                }),
            );
        }, 500);

        return () => window.clearTimeout(timeout);
    }, [descriptionMd, descriptionImageRefs]);

    /** 서버 데이터 → 상태 매핑 + 스냅샷 저장 */
    useEffect(() => {
        if (!data) return;
        const d: any = data;

        console.groupCollapsed("%c[EditProblem] loaded & normalized", "color:#0ea5e9");
        // console.log(d);
        console.groupEnd();

        const title = d.title ?? d.problem_name ?? "";
        const rawDescription = d.content ?? d.description ?? "";
        const parsedDescription = splitDescriptionAndImageRefs(rawDescription);
        const normalizedDescription = migrateInlineBase64Images(
            parsedDescription.body,
            parsedDescription.imageRefs,
        );
        const composedDescription = composeDescriptionWithImageRefs(
            normalizedDescription.body,
            normalizedDescription.imageRefs,
            { pruneUnused: true },
        );
        const limit_time = d.limit_time ?? 100;
        const limit_memory = d.limit_memory ?? 128;
        const type: "GENERAL" | "CHECKER" = d.type === "CHECKER" ? "CHECKER" : "GENERAL";
        const checker_code: string | null = d.checker_code ?? null;
        const diff: "EASY" | "MEDIUM" | "HARD" | undefined = d.difficulty;
        const share = typeof d.share === "boolean" ? d.share : false;

        // 템플릿/언어
        const langs: Lang[] = [];
        const tpl: Partial<Record<Lang, TemplateFile[]>> = {};
        const buckets: any[] = Array.isArray(d.template_codes) ? d.template_codes : [];
        for (const bucket of buckets) {
            const key = toLanguageFromName(bucket?.language);
            if (!key) continue;
            langs.push(key);
            tpl[key] = normalizeTemplateFilesForLanguage(
                key,
                (bucket?.files ?? []).map((f: any) => ({
                    filename: f?.filename ?? "",
                    code: f?.content ?? "",
                })),
            );
        }

        const testcaseFiles = toTestCaseFiles(d.testcases);
        setInputFiles(testcaseFiles.inputFiles.length ? testcaseFiles.inputFiles : null);
        setOutputFiles(testcaseFiles.outputFiles.length ? testcaseFiles.outputFiles : null);

        setProblemTitle(title);
        setDescriptionMd(normalizedDescription.body);
        setDescriptionImageRefs(normalizedDescription.imageRefs);
        setPreviewDescriptionMd(composedDescription);
        setTimeLimit(limit_time);
        setMemoryLimit(limit_memory);
        setProblemType(type === "CHECKER" ? "checker" : "general");
        setCheckerCode(checker_code ?? "// 채점용 코드를 작성하세요");
        setDifficulty((diff as any) ?? "MEDIUM");
        setShare(share);
        setSelectedLangs(Array.from(new Set(langs)));
        setTemplateCodesWithLock(tpl);

        // 스냅샷
        originalRef.current = {
            title,
            description: composedDescription,
            type,
            limit_time,
            limit_memory,
            difficulty: diff,
            checker_code,
            langs: Array.from(new Set(langs)),
            templates: deepCloneTemplates(((): Record<Lang, TemplateFile[]> => {
                const out: Record<Lang, TemplateFile[]> = {} as any;
                for (const l of ALL_LANGS) out[l] = tpl[l] ?? [];
                return out;
            })()),
            share,
        };
    }, [data]);

    const buildCurrentNormalized = useCallback((): NormalizedDetail => {
        return {
            title: problemTitle,
            description: composeDescriptionWithImageRefs(descriptionMd, descriptionImageRefs, {
                pruneUnused: true,
            }),
            type: problemType === "checker" ? "CHECKER" : "GENERAL",
            limit_time: timeLimit,
            limit_memory: memoryLimit,
            difficulty,
            checker_code: problemType === "checker" ? (checkerCode ?? "") : "",
            langs: selectedLangs,
            templates: deepCloneTemplates(((): Record<Lang, TemplateFile[]> => {
                const out: Record<Lang, TemplateFile[]> = {} as any;
                for (const l of ALL_LANGS) out[l] = filledTemplateCodes[l] ?? [];
                return out;
            })()),
            share,
        };
    }, [
        problemTitle,
        descriptionMd,
        descriptionImageRefs,
        problemType,
        timeLimit,
        memoryLimit,
        difficulty,
        checkerCode,
        selectedLangs,
        filledTemplateCodes,
        share,
    ]);

    /** 변경점만 추출 → PATCH 바디 구성 */
    const buildPatchBody = useCallback(async (forceFull = false): Promise<PatchProblemBody> => {
        const orig = originalRef.current;
        const cur = buildCurrentNormalized();
        const testcases = await buildPatchTestcases(
            inputFiles,
            outputFiles,
            problemType,
        );

        const body: PatchProblemBody = {};
        const mapLangIds = (langs: Lang[]) => {
            const ids = languageIndexesFromLangs(langs);
            if (langs.length > 0 && ids.length !== langs.length) {
                throw new Error("언어 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
            }
            return ids;
        };

        // ✅ 요구 포맷: { language: "<lang>", files: [{ filename, content }...] }[]
        const buildTemplateCodes = () => {
            return buildTemplateCodePayload(cur.langs, cur.templates);
        };

        if (forceFull) {
            return {
                title: cur.title,
                description: cur.description,
                type: cur.type,
                difficulty: cur.difficulty,
                limit_time: cur.limit_time,
                limit_memory: cur.limit_memory,
                checker_code: cur.checker_code ?? "",
                share: cur.share,
                language: mapLangIds(cur.langs),
                template_codes: buildTemplateCodes(),
                testcases,
            };
        }

        if (!orig) {
            body.title = cur.title;
            body.description = cur.description;
            body.type = cur.type;
            body.difficulty = cur.difficulty;
            body.limit_time = cur.limit_time;
            body.limit_memory = cur.limit_memory;
            body.checker_code = cur.checker_code ?? "";
            body.share = cur.share;
            // 최초에도 일관성 있게 함께 전송
            body.language = mapLangIds(cur.langs);
            body.template_codes = buildTemplateCodes();
            body.testcases = testcases;
            return body;
        }

        // 기본 메타
        if (orig.title !== cur.title) body.title = cur.title;
        if (orig.description !== cur.description) body.description = cur.description;
        if (orig.type !== cur.type) body.type = cur.type;
        if (orig.difficulty !== cur.difficulty) body.difficulty = cur.difficulty;
        if (orig.limit_time !== cur.limit_time) body.limit_time = cur.limit_time;
        if (orig.limit_memory !== cur.limit_memory) body.limit_memory = cur.limit_memory;
        if (orig.share !== cur.share) body.share = cur.share;

        // 체크커 삭제/변경
        const needDeleteChecker =
            orig.type === "CHECKER" && cur.type === "GENERAL" && (orig.checker_code ?? null) !== null;
        if (needDeleteChecker) {
            body.checker_code = "";
        } else if ((orig.checker_code ?? "") !== (cur.checker_code ?? "")) {
            body.checker_code = cur.checker_code ?? "";
        }

        // 언어/템플릿 변화 감지
        const langsChanged = !sameSet(orig.langs, cur.langs);
        const tChanged = templatesDiffer(orig.templates, cur.templates);

        // ✅ 언어가 변하거나 템플릿이 변하면 항상 language + template_codes 동시 전송
        if (langsChanged || tChanged) {
            body.language = mapLangIds(cur.langs);
            body.template_codes = buildTemplateCodes();
        }

        body.testcases = testcases;
        return body;
    }, [buildCurrentNormalized, languageIndexesFromLangs, inputFiles, outputFiles, problemType]);

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            let body: PatchProblemBody;
            try {
                body = await buildPatchBody();
                if (Object.keys(body).length === 0) {
                    body = await buildPatchBody(true);
                }
            } catch (err) {
                alert((err as Error).message);
                return;
            }

            console.group("%c[PATCH body]", "color:#22c55e");
            // console.log(JSON.stringify(body, null, 2));
            console.groupEnd();

            try {
                await doPatch(body);
                alert("수정이 완료되었습니다.");
                originalRef.current = buildCurrentNormalized();
                router.push("/problem");
            } catch {
                alert("수정 중 오류가 발생했습니다. 콘솔을 확인해 주세요.");
            }
        },
        [buildPatchBody, doPatch, buildCurrentNormalized, router]
    );

    // 공통 폼 프롭
    const formProps = {
        // step-1
        problemTitle,
        setProblemTitle,
        descriptionMd,
        setDescriptionMd,
        descriptionImageRefs,
        setDescriptionImageRefs,
        usePdf,
        setUsePdf,
        handlePdfUpload,
        difficulty,
        setDifficulty,
        timeLimit,
        setTimeLimit,
        memoryLimit,
        setMemoryLimit,
        selectedLangs,
        setSelectedLangs,
        share,
        setShare,
        breadcrumbActionLabel: "문제 수정",
        breadcrumbTitle: problemTitle || "제목 미입력",

        // step-2
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

        templateCodes,
        setTemplateCodes: setTemplateCodesWithLock,

        onCancel: () => history.back(),
        onSubmit: handleSubmit,
        onStepChange: setStep,
        submitting: patching,
    };

    if (!pid) {
        return (
            <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
                <div className="fluid-container flex min-h-[50vh] items-center justify-center">
                    <div className="text-sm text-red-500">잘못된 문제 ID입니다.</div>
                </div>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
                <div className="fluid-container flex min-h-[50vh] items-center justify-center">
                    <div className="text-sm text-gray-400">문제 정보를 불러오는 중...</div>
                </div>
            </section>
        );
    }

    if (isError || !data) {
        return (
            <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
                <div className="fluid-container flex min-h-[50vh] items-center justify-center">
                    <div className="text-sm text-red-500">
                        문제 정보를 불러오지 못했습니다. {String((error as any)?.message ?? "")}
                    </div>
                </div>
            </section>
        );
    }

    if (!data.canEdit) {
        return (
            <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
                <div className="fluid-container flex min-h-[50vh] flex-col items-center justify-center gap-4">
                    <div className="text-sm text-red-500">이 문제를 수정할 권한이 없습니다.</div>
                    <button
                        type="button"
                        className="font-kr rounded-[10px] border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => router.push("/problem")}
                    >
                        문제 목록으로
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
            <div className="fluid-container flex h-full flex-col overflow-hidden lg:flex-row">
                {/* 왼쪽: 위저드 폼 */}
                <AddProblemForm {...formProps} />

                {/* 오른쪽: 프리뷰/템플릿 에디터 */}
                <div className="h-full w-full overflow-auto bg-gray-900 pb-4 text-white lg:w-1/2 lg:px-[clamp(12px,1vw,18px)]">
                    {step === 1 ? (
                        <>
                            <h4 className="mb-1 text-3xl font-semibold text-gray-300">
                                {problemTitle || "(제목 미입력)"}
                            </h4>
                            <div className="mb-2 flex space-x-1 px-1 text-sm text-gray-400">
                                <p>시간 제한: {timeLimit}ms /</p>
                                <p>메모리 제한: {memoryLimit}MB /</p>
                                {selectedLangs.length > 0 && <p>허용 언어: {selectedLangs.join(", ")} /</p>}
                                <p>문제 타입: {problemType === "general" ? "General" : "Checker"}</p>
                            </div>

                            <SolveComponentLeft
                                pdfFile={usePdf && pdfUrl ? pdfUrl : ""}
                                markdownContent={usePdf ? undefined : previewDescriptionMd}
                            />
                        </>
                    ) : (
                        <AddTemplateEditorForm
                            selectedLangs={selectedLangs}
                            templateCodes={templateCodes}
                            setTemplateCodes={setTemplateCodesWithLock}
                        />
                    )}
                </div>
            </div>
        </section>
    );
};

export default EditProblemPage;
