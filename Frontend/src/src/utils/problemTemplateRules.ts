import type { Lang, TemplateFile } from "@/types/problemCreation";

const LOCKED_PRIMARY_TEMPLATE_FILENAMES: Partial<Record<Lang, string>> = {
  java: "Main.java",
  python: "main.py",
};

export const getLockedPrimaryTemplateFilename = (lang: Lang): string | null =>
  LOCKED_PRIMARY_TEMPLATE_FILENAMES[lang] ?? null;

export const isLockedPrimaryTemplate = (lang: Lang, index: number): boolean =>
  index === 0 && getLockedPrimaryTemplateFilename(lang) !== null;

export const normalizeTemplateFilesForLanguage = (
  lang: Lang,
  files: TemplateFile[],
): TemplateFile[] => {
  const lockedFilename = getLockedPrimaryTemplateFilename(lang);
  const nextFiles = files.map((file) => ({ ...file }));

  if (!lockedFilename || nextFiles.length === 0) {
    return nextFiles;
  }

  const lockedIndex = nextFiles.findIndex(
    (file) => file.filename === lockedFilename,
  );
  if (lockedIndex > 0) {
    const [lockedFile] = nextFiles.splice(lockedIndex, 1);
    nextFiles.unshift(lockedFile);
  }

  nextFiles[0] = {
    ...nextFiles[0],
    filename: lockedFilename,
  };
  return nextFiles;
};

export const normalizeTemplateCodeState = (
  templateCodes: Partial<Record<Lang, TemplateFile[]>>,
): Partial<Record<Lang, TemplateFile[]>> => {
  const nextCodes: Partial<Record<Lang, TemplateFile[]>> = {};

  (Object.keys(templateCodes) as Lang[]).forEach((lang) => {
    nextCodes[lang] = normalizeTemplateFilesForLanguage(
      lang,
      templateCodes[lang] ?? [],
    );
  });

  return nextCodes;
};

export const buildTemplateCodePayload = (
  selectedLangs: Lang[],
  templateCodes: Partial<Record<Lang, TemplateFile[]>>,
) =>
  selectedLangs.map((lang) => ({
    language: lang,
    files: normalizeTemplateFilesForLanguage(lang, templateCodes[lang] ?? []).map(
      (file) => ({
        filename: file.filename,
        content: file.code,
      }),
    ),
  }));
