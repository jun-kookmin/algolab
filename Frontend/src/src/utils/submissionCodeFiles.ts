import {
  LANGUAGES,
  mapLanguages,
  toLanguage,
  toLanguageFromName,
  type Language,
} from "@/types/languages";

export interface SubmissionCodeFile {
  filename: string;
  content: string;
}

const DEFAULT_FILENAME_BY_LANG: Record<Language, string> = {
  [LANGUAGES.C]: "main.c",
  [LANGUAGES.CPP]: "main.cpp",
  [LANGUAGES.PYTHON]: "main.py",
  [LANGUAGES.JAVA]: "Main.java",
};

const detectLanguageFromFilename = (filename: string): Language | undefined => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".c")) return LANGUAGES.C;
  if (
    lower.endsWith(".cpp") ||
    lower.endsWith(".cc") ||
    lower.endsWith(".cxx") ||
    lower.endsWith(".hpp") ||
    lower.endsWith(".hxx")
  ) {
    return LANGUAGES.CPP;
  }
  if (lower.endsWith(".py")) return LANGUAGES.PYTHON;
  if (lower.endsWith(".java")) return LANGUAGES.JAVA;
  return undefined;
};

export const normalizeSubmissionLanguage = (
  rawLanguage: unknown
): Language | undefined => {
  if (Array.isArray(rawLanguage)) {
    const fromIds = mapLanguages(
      rawLanguage.filter(
        (item): item is number | string =>
          typeof item === "number" || typeof item === "string"
      )
    );
    if (fromIds.length > 0) return fromIds[0];
    return normalizeSubmissionLanguage(rawLanguage[0]);
  }

  if (typeof rawLanguage === "number") {
    return mapLanguages([rawLanguage])[0];
  }

  if (typeof rawLanguage === "string") {
    const trimmed = rawLanguage.trim();
    if (!trimmed) return undefined;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return mapLanguages([asNumber])[0];
    }
    return toLanguage(trimmed) ?? toLanguageFromName(trimmed);
  }

  return undefined;
};

export const defaultFilenameForSubmissionLanguage = (
  rawLanguage: unknown
): string => {
  const language = normalizeSubmissionLanguage(rawLanguage) ?? LANGUAGES.CPP;
  return DEFAULT_FILENAME_BY_LANG[language] ?? "main.txt";
};

const normalizeFileMapEntries = (
  value: unknown
): SubmissionCodeFile[] | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([filename]) => typeof filename === "string" && filename.trim().length > 0
  );
  if (entries.length === 0) return null;

  return entries.map(([filename, content]) => ({
    filename: filename.trim(),
    content: content == null ? "" : String(content),
  }));
};

export const parseSubmissionCodeFiles = (
  rawCode: unknown,
  fallbackFilename: string
): SubmissionCodeFile[] => {
  if (rawCode == null) {
    return [{ filename: fallbackFilename, content: "" }];
  }

  const directMap = normalizeFileMapEntries(rawCode);
  if (directMap) {
    return directMap.length > 0
      ? directMap
      : [{ filename: fallbackFilename, content: "" }];
  }

  if (typeof rawCode === "string") {
    const trimmed = rawCode.trim();
    if (!trimmed) {
      return [{ filename: fallbackFilename, content: "" }];
    }

    try {
      const parsed = JSON.parse(trimmed);
      const parsedMap = normalizeFileMapEntries(parsed);
      if (parsedMap) return parsedMap;
      if (typeof parsed === "string") {
        return [{ filename: fallbackFilename, content: parsed }];
      }
    } catch {
      // Plain source code string.
    }

    return [{ filename: fallbackFilename, content: rawCode }];
  }

  return [{ filename: fallbackFilename, content: String(rawCode) }];
};

export const languageForCodeFile = (
  filename: string,
  fallbackLanguage?: Language
): Language => {
  return detectLanguageFromFilename(filename) ?? fallbackLanguage ?? LANGUAGES.CPP;
};
