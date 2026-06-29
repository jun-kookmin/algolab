"use client";

import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import AddProblemForm from "@/components/addProblem/AddProblemForm";
import type {
  WizardStep,
  Lang,
  ProblemType,
  TemplateFile,
} from "@/types/problemCreation";
import { useCreateProblem } from "@/hooks/problems/post/useCreateProblem";
import { useRouter } from "next/navigation";
import { mapLanguagesNum } from "@/types/languages";
import { useQueryClient } from "@tanstack/react-query";
import { composeDescriptionWithImageRefs } from "@/utils/problemMarkdownImageRefs";
import { estimateImageRefBytes, formatByteCount } from "@/utils/problemMarkdownImageRefs";
import { isCsrfMismatch } from "@/utils/authApi";
import {
  buildTemplateCodePayload,
  normalizeTemplateCodeState,
} from "@/utils/problemTemplateRules";

/* 모든 지원 언어 목록 (필요에 따라 추가) */
const SolveComponentLeft = dynamic(
  () => import("@/components/solve/SolveComponentLeft"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded bg-gray-800 text-sm text-gray-400">
        미리보기 로딩 중...
      </div>
    ),
  }
);

const AddTemplateEditorForm = dynamic(
  () => import("@/components/addProblem/AddTemplateEditorForm"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded bg-gray-800 text-sm text-gray-400">
        에디터 로딩 중...
      </div>
    ),
  }
);

/** 서버 멀터(또는 업로더) 스키마를 흉내내는 파일 디스크립터 (콘솔용 모형) */
/** 테스트케이스 스키마 */
type TestcaseIO = {
  index: number;
  content: string;
};
type TestcasePair = {
  input?: TestcaseIO;
  output?: TestcaseIO;
};
type TestcaseBuildResult = {
  testcases: TestcasePair[];
  skippedPairs: string[];
};
type ProblemDataBuildResult = {
  problemData: {
    title: string;
    description: string;
    type: "GENERAL" | "CHECKER";
    difficulty: "EASY" | "MEDIUM" | "HARD";
    limit_time: number;
    limit_memory: number;
    share: boolean;
    languages: number[];
    template_codes: Array<{
      language: Lang;
      files: Array<{ filename: string; content: string }>;
    }>;
    testcases: TestcasePair[];
    checker_code?: string;
  };
  skippedPairs: string[];
};

const formatCaseFileNames = (names: string[]) =>
  names.length ? names.join(", ") : "(없음)";

const DEFAULT_PROBLEM_DESCRIPTION_TEMPLATE = [
  "## 1. 문제 설명",
  "여기에 문제의 배경과 해결해야 할 과제를 입력하세요.",
  "",
  "---",
  "",
  "## 2. 입출력 형식",
  "",
  "### **입력**",
  "- 첫 번째 줄에 ...이 주어집니다.",
  "- 두 번째 줄에는 ...",
  "",
  "### **출력**",
  "- 문제에서 요구하는 ...을 출력합니다.",
  "",
  "---",
  "",
  ":::copy-io 테스트케이스 1",
  "[input]",
  "1 2 3",
  "4 5 6",
  "[/input]",
  "[output]",
  "6",
  "[/output]",
  ":::",
  "",
  ":::copy-io 테스트케이스 2",
  "[input]",
  "[입력값 입력]",
  "[/input]",
  "[output]",
  "[출력값 입력]",
  "[/output]",
  ":::",
  "",
  "---",
  "",
].join("\n");

const resolveCreateErrorMessage = (rawData: unknown): string => {
  if (!rawData) return "요청 형식 또는 권한을 다시 확인해 주세요.";

  if (typeof rawData === "string") {
    if (rawData.includes("<html")) {
      return "서버에서 HTML 오류 응답이 반환되었습니다.";
    }
    return rawData.slice(0, 4000);
  }

  const asObj = rawData as Record<string, unknown>;
  if (asObj.detail) {
    if (typeof asObj.detail === "string") return asObj.detail;
    return JSON.stringify(asObj.detail);
  }
  if (asObj.non_field_errors) return JSON.stringify(asObj.non_field_errors);

  const fieldErrors = Object.entries(asObj)
    .map(([key, val]) => `${key}: ${JSON.stringify(val)}`)
    .join("\n");
  if (fieldErrors) return fieldErrors;

  return "요청 형식 또는 권한을 다시 확인해 주세요.";
};

const MAX_CREATE_PAYLOAD_BYTES = 30 * 1024 * 1024;
const MAX_CREATE_IMAGE_PAYLOAD_BYTES = 16 * 1024 * 1024;

const getPayloadBytes = (payload: unknown): number =>
  new TextEncoder().encode(JSON.stringify(payload)).byteLength;

const AddProblemPage: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  /* ─┐ wizard step */
  const [step, setStep] = useState<WizardStep>(1);
  /* ─┐ 1단계: 메타 & 제한값 */
  const [problemTitle, setProblemTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState(
    DEFAULT_PROBLEM_DESCRIPTION_TEMPLATE
  );
  const [descriptionImageRefs, setDescriptionImageRefs] = useState<
    Record<string, string>
  >({});
  const [usePdf, setUsePdf] = useState(false);
  const [share, setShare] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState(100);
  const [memoryLimit, setMemoryLimit] = useState(128);
  const [selectedLangs, setSelectedLangs] = useState<Lang[]>([]);
  const languageIndexes = useMemo(() => {
    return mapLanguagesNum(selectedLangs);
  }, [selectedLangs]);

  /* ─┐ 2단계: 채점 & 템플릿 */
  const [problemType, setProblemType] = useState<ProblemType>("general");
  const [inputFiles, setInputFiles] = useState<File[] | null>(null);
  const [outputFiles, setOutputFiles] = useState<File[] | null>(null);
  const [checkerCode, setCheckerCode] = useState("// 채점용 코드를 작성하세요");
  const [checkerLang, setCheckerLang] = useState<Lang>("cpp");

  /* 난이도 */
  const [difficulty, setDifficulty] =
    useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");

  /* ⬇ 핵심: Partial 로 보관 */
  const [templateCodes, setTemplateCodes] = useState<
    Partial<Record<Lang, TemplateFile[]>>
  >({});
  const setTemplateCodesWithLock = useCallback<
    React.Dispatch<React.SetStateAction<Partial<Record<Lang, TemplateFile[]>>>>
  >((value) => {
    setTemplateCodes((prev) =>
      normalizeTemplateCodeState(
        typeof value === "function" ? value(prev) : value,
      ),
    );
  }, []);
  const [previewDescriptionMd, setPreviewDescriptionMd] = useState("");
  const submitInFlightRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const composeDescriptionForSubmit = useCallback(
    () =>
      composeDescriptionWithImageRefs(descriptionMd, descriptionImageRefs, {
        pruneUnused: true,
      }),
    [descriptionMd, descriptionImageRefs]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPreviewDescriptionMd(
        composeDescriptionWithImageRefs(descriptionMd, descriptionImageRefs, {
          pruneUnused: true,
        })
      );
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [descriptionMd, descriptionImageRefs]);

  /* ─┐ create-problem mutation */
  const { mutateAsync: createProblem } = useCreateProblem({
    onSuccess: () => {
      // 성공 후 처리: 라우팅/토스트 등 필요 시 여기에
      // console.log("[CreateProblem] success:", res);
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      alert("문제가 생성되었습니다.");
      router.push("/problem");
    },
    onError: (err: any) => {
      // console.error("[CreateProblem] error:", err);
      const status = err?.response?.status;
      const detailData = err?.response?.data;

      if (status === 403 && isCsrfMismatch(detailData)) {
        alert("요청 보안 토큰이 최신 상태가 아닙니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
      } else if (status === 413) {
        alert("요청 데이터가 너무 큽니다. 테스트케이스 또는 템플릿 내용을 줄여서 다시 시도해 주세요.");
      } else if (status === 400) {
        const detail = resolveCreateErrorMessage(detailData);
        alert(`문제 생성 요청이 유효하지 않습니다.\n${detail}`);
      } else {
        alert("문제 생성 중 오류가 발생했습니다.");
      }
    },
  });

  /* ─┐ handlers */
  const handlePdfUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfUrl(URL.createObjectURL(file));
    } else {
      setPdfUrl(null);
    }
  }, []);

  /** 확장자 제거한 베이스네임 추출 */
  const basename = (filename: string) =>
    filename.replace(/\.(in|out|output)$/i, "");

  /** 자연스러운 정렬 (숫자 인식) */
  const natcmp = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

  /** 파일 배열을 Map<basename, text>로 변환 */
  const filesToTextMap = async (files: File[] | null) => {
    const map = new Map<string, string>();
    if (!files?.length) return map;

    await Promise.all(
      files.map(async (f) => {
        const name = basename(f.name);
        const text = await f.text(); // UTF-8 가정
        map.set(name, text);
      })
    );
    return map;
  };

  /** 입력/출력을 basename으로 페어링하여 TestcasePair[] 구성 (index+content 구조) */
  const buildTestcases = useCallback(async (): Promise<TestcaseBuildResult> => {
    const inMap = await filesToTextMap(inputFiles);
    const outMap = await filesToTextMap(outputFiles);

    const allNames = Array.from(
      new Set([...inMap.keys(), ...outMap.keys()])
    ).sort(natcmp);
    const skippedPairs: string[] = [];
    const testcases: TestcasePair[] = [];

    let nextIndex = 1;

    allNames.forEach((name) => {
      const inputTxt = inMap.get(name);
      const outputTxt = outMap.get(name);

      if (problemType === "checker") {
        // checker는 입력 파일만 있어도 테스트케이스로 인정
        if (inputTxt === undefined) {
          skippedPairs.push(name);
          return;
        }

        const index = nextIndex++;
        const row: TestcasePair = {};
        if (inputTxt !== undefined) {
          row.input = { index, content: inputTxt };
        }
        if (outputTxt !== undefined) {
          row.output = { index, content: outputTxt };
        }
        testcases.push(row as TestcasePair);
        return;
      }

      if (inputTxt === undefined || outputTxt === undefined) {
        skippedPairs.push(name);
        return;
      }

      const index = nextIndex++;
      testcases.push({
        input: { index, content: inputTxt },
        output: { index, content: outputTxt },
      });
    });

    return { testcases, skippedPairs };
  }, [inputFiles, outputFiles, problemType]);

  /** problemData(본문 JSON) 생성 + testcases 포함
   *  - 문제 설명 키: description
   *  - 난이도 키: difficulty
   */
  const buildProblemData = useCallback(
    async (): Promise<ProblemDataBuildResult> => {
      const typeApi = problemType === "checker" ? "CHECKER" : "GENERAL";
      if (!problemTitle.trim()) {
        throw new Error("문제 제목을 입력해 주세요.");
      }

      // "languages": [1, 2] 형태 (백엔드 enum에 맞추세요)
      const languages = languageIndexes.filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v)
      );
      if (selectedLangs.length > 0 && languages.length !== selectedLangs.length) {
        throw new Error("언어 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      }

      const template_codes = buildTemplateCodePayload(
        selectedLangs,
        templateCodes,
      );

      // .in / .out 내용을 문자열로 읽어 testcases(index+content) 구성
      const { testcases, skippedPairs } = await buildTestcases();
      if (skippedPairs.length) {
        // console.warn(
          // "[CreateProblem] 짝이 맞지 않는 테스트케이스 파일은 전송하지 않습니다:",
          // skippedPairs
        // );
      }

      const data: ProblemDataBuildResult["problemData"] = {
        title: problemTitle,
        description: composeDescriptionForSubmit(), // ← content가 아닌 description
        type: typeApi,
        difficulty, // ← level이 아닌 difficulty
        limit_time: timeLimit,
        limit_memory: memoryLimit,
        share,
        languages,
        template_codes,
        testcases, // [{ input: {index,content}, output: {index,content} }]
      };

      if (problemType === "checker") {
        data.checker_code = checkerCode;
        // 필요시 data.checker_lang = checkerLang; // 백엔드 스펙에 맞춰 사용
      }

      return { problemData: data, skippedPairs };
    },
    [
      problemTitle,
      composeDescriptionForSubmit,
      problemType,
      difficulty,
      timeLimit,
      memoryLimit,
      share,
      selectedLangs,
      templateCodes,
      checkerCode,
      buildTestcases,
      languageIndexes,
    ]
  );

  // onSubmit: 실제 API 호출
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (submitInFlightRef.current) {
        return;
      }
      submitInFlightRef.current = true;
      setIsSubmitting(true);

      (async () => {
        try {
          let payload;
          try {
            payload = await buildProblemData();
          } catch (err) {
            alert((err as Error).message);
            return;
          }

          const { skippedPairs, problemData } = payload;
          const imagePayloadBytes = estimateImageRefBytes(descriptionImageRefs);
          const requestPayloadBytes = getPayloadBytes({ problemData });

          if (imagePayloadBytes > MAX_CREATE_IMAGE_PAYLOAD_BYTES) {
            alert(
              `문제 설명 이미지 용량이 ${formatByteCount(imagePayloadBytes)}로 너무 큽니다. ` +
                `이미지 합계는 최대 ${formatByteCount(MAX_CREATE_IMAGE_PAYLOAD_BYTES)}까지만 허용됩니다.`,
            );
            return;
          }

          if (requestPayloadBytes > MAX_CREATE_PAYLOAD_BYTES) {
            alert(
              `요청 데이터가 너무 큽니다 (${formatByteCount(requestPayloadBytes)}). ` +
                `${formatByteCount(MAX_CREATE_PAYLOAD_BYTES)} 이하로 줄여서 다시 시도해 주세요.`,
            );
            return;
          }

          if (skippedPairs.length > 0) {
            const isChecker = problemType === "checker";
            alert(
              isChecker
                ? `체커 문제는 입력 파일만 있어도 테스트케이스로 처리합니다.\n` +
                  `제외된 파일: ${formatCaseFileNames(skippedPairs)}\n` +
                  `입력/출력 파일명이 일치하지 않는 항목은 건너뜁니다.`
                : `테스트케이스 입력/출력 파일 짝이 맞지 않습니다.\n` +
                  `제외된 파일: ${formatCaseFileNames(skippedPairs)}\n` +
                  `입력/출력 파일명이 일치하는 항목만 전송합니다.`
            );
          }

          // 콘솔에도 description/difficulty 로 표시됨
          console.group("%c[REQUEST BODY for POST]", "color:#0bf");
          // console.log(JSON.stringify({ problemData }, null, 2));
          console.groupEnd();

          try {
            await createProblem({ problemData });
          } catch {
            // onError 콜백에서 사용자 메시지를 처리한다.
          }
        } finally {
          submitInFlightRef.current = false;
          setIsSubmitting(false);
        }
      })();
    },
    [buildProblemData, createProblem, descriptionImageRefs, problemType]
  );

  /* ─┐ memoized preview helpers */
  const langList = useMemo(
    () => (selectedLangs.length ? selectedLangs.join(", ") : undefined),
    [selectedLangs]
  );

  /* ─┐ form props 집합 */
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
    share,
    setShare,
    difficulty,
    setDifficulty,
    timeLimit,
    setTimeLimit,
    memoryLimit,
    setMemoryLimit,
    selectedLangs,
    setSelectedLangs,

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

    // actions
    onCancel: () => history.back(),
    onSubmit: handleSubmit,
    onStepChange: setStep,
    isSubmitting,
  };

  return (
    <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
      <div className="fluid-container flex h-full flex-col overflow-hidden lg:flex-row">
        {/* Wizard Form (왼쪽) */}
        <AddProblemForm {...formProps} />

        {/* Preview or Template Editor (오른쪽) */}
        <div className="h-full w-full overflow-auto bg-gray-900 pb-4 text-white lg:w-1/2 lg:px-[clamp(12px,1vw,18px)]">
          {step === 1 ? (
            <>
              <h4 className="mb-1 text-3xl font-semibold text-gray-300">
                {problemTitle || "(제목 미입력)"}
              </h4>
              <div className="flex px-1 mb-2 space-x-1 text-sm text-gray-400">
                <p>시간 제한: {timeLimit}ms /</p>
                <p>메모리 제한: {memoryLimit}MB /</p>
                {langList && <p>허용 언어: {langList} /</p>}
                <p>
                  문제 타입:{" "}
                  {problemType === "general"
                    ? "General"
                    : problemType === "checker"
                    ? "Checker"
                    : "Multi"}
                </p>
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

export default AddProblemPage;
