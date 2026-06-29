// ──── FILE: src/types/problemCreationForm.ts ────
import type { ProblemDifficulty } from "@/types/difficulties";
export type ProblemType = "general" | "checker";

export type Lang = "c" | "cpp" | "java" | "python";

export interface TemplateFile {
  filename: string;
  code: string;
}

export interface FirstStepProps {
  problemTitle: string;
  setProblemTitle: (v: string) => void;
  descriptionMd: string;
  setDescriptionMd: (v: string) => void;
  descriptionImageRefs: Record<string, string>;
  setDescriptionImageRefs: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  usePdf: boolean;
  setUsePdf: (b: boolean) => void;
  handlePdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  share: boolean;
  setShare: (b: boolean) => void;
  difficulty: ProblemDifficulty;
  setDifficulty: (d: ProblemDifficulty) => void;
  timeLimit: number;
  setTimeLimit: (n: number) => void;
  memoryLimit: number;
  setMemoryLimit: (n: number) => void;
  breadcrumbActionLabel?: string;
  breadcrumbTitle?: string;
  onCancel: () => void;
  onNext: () => void;
}

export type CheckerLang = "c" | "cpp" | "java" | "python";

export interface SecondStepProps {
  problemType: ProblemType;
  setProblemType: (v: ProblemType) => void;
  inputFiles: File[] | null;
  setInputFiles: (files: File[] | null) => void;
  outputFiles: File[] | null;
  setOutputFiles: (files: File[] | null) => void;
  checkerCode: string;
  setCheckerCode: (code: string) => void;
  checkerLang: Lang;
  setCheckerLang: (l: Lang) => void;
  selectedLangs: Lang[];
  setSelectedLangs: React.Dispatch<React.SetStateAction<Lang[]>>;
  templateCodes: Partial<Record<Lang, TemplateFile[]>>;
  setTemplateCodes: React.Dispatch<
    React.SetStateAction<Partial<Record<Lang, TemplateFile[]>>>
  >;
  breadcrumbActionLabel?: string;
  breadcrumbTitle?: string;
  onBack: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

// step 구분
export type WizardStep = 1 | 2;

export interface AddProblemFormProps
  extends Omit<FirstStepProps, "onNext">,
    Omit<SecondStepProps, "onBack" | "onSubmit"> {
  onStepChange: (step: WizardStep) => void;
  onSubmit: (e: React.FormEvent) => void;
}
