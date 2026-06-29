// src/constants/types/languages.ts

// 1) 언어 정의 (enum 스타일)
//  - enum과 유사하게 문자열 상수를 정의합니다.
//  - 예: LANGUAGES.C  → "C"
export const LANGUAGES = {
  C: "c",
  CPP: "cpp",
  PYTHON: "python",
  JAVA: "java",
} as const;

// 2) 타입 정의
//  - LANGUAGES 객체의 값만을 허용하는 유니온 타입입니다.
//  - 예: "C" | "C++" | "Python" | "Java"
export type Language = typeof LANGUAGES[keyof typeof LANGUAGES];

// 3) 숫자 ID → 언어 매핑
//  - 서버에서 내려준 number ID를 Language로 변환할 때 사용합니다.
export const LANGUAGE_MAP: Record<number, Language> = {
  0: LANGUAGES.C,
  1: LANGUAGES.CPP,
  2: LANGUAGES.PYTHON,
  3: LANGUAGES.JAVA,
};

// 3-2) 언어 → 숫자 ID 매핑
//  - 프론트에서 Language를 다시 number ID로 보낼 때 사용합니다.
export const LANGUAGE_NUM_MAP: Record<Language, number> = {
  [LANGUAGES.C]: 0,
  [LANGUAGES.CPP]: 1,
  [LANGUAGES.PYTHON]: 2,
  [LANGUAGES.JAVA]: 3,
};

export function normalizeLanguageInput(
  value: unknown
): Language | undefined {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;

  if (typeof value === "number" && Number.isFinite(value)) {
    return LANGUAGE_MAP[value];
  }

  if (typeof value === "string") {
    const asString = value.trim();
    if (!asString) return undefined;

    if (/^-?\d+$/.test(asString)) {
      const num = Number(asString);
      return LANGUAGE_MAP[num];
    }

    if (Object.values(LANGUAGES).includes(asString.toLowerCase() as Language)) {
      return asString.toLowerCase() as Language;
    }

    if (asString === "C++" || asString === "cpp" || asString === "c++") {
      return LANGUAGES.CPP;
    }
    if (asString === "C" || asString === "c") {
      return LANGUAGES.C;
    }
    if (asString === "Python" || asString.toLowerCase() === "python") {
      return LANGUAGES.PYTHON;
    }
    if (asString === "Java" || asString.toLowerCase() === "java") {
      return LANGUAGES.JAVA;
    }
    return toLanguageFromName(asString);
  }

  return undefined;
}

// 4) 문자열 입력 처리 (대소문자 무시 변환)
//  - 문자열을 Language 타입으로 변환합니다.
//  - 잘못된 문자열이면 undefined를 반환합니다.
//  - 예: toLanguage("python") → "Python"
export function toLanguage(v: unknown): Language | undefined {
  if (typeof v !== "string") return undefined;
  const match = Object.values(LANGUAGES).find(
    lang => lang.toLowerCase() === v.trim().toLowerCase()
  );
  return match as Language | undefined;
}

export function toLanguageFromName(name?: string): Language | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "c") return LANGUAGES.C;
  if (normalized === "c++" || normalized === "cpp" || normalized === "cxx" || normalized === "cc") {
    return LANGUAGES.CPP;
  }
  if (normalized === "python" || normalized === "py" || normalized === "python3") {
    return LANGUAGES.PYTHON;
  }
  if (normalized === "java") return LANGUAGES.JAVA;
  return undefined;
}

/** number[] → Language[] (존재하지 않는 ID는 제외)
 *  - 서버에서 내려준 number[] 배열을 Language[]로 변환합니다.
 */
export function mapLanguages(ids?: Array<number | string>): Language[] {
  return (ids ?? [])
    .map((id) => normalizeLanguageInput(id))
    .filter((v): v is Language => !!v);
}

/** Language[] → number[] (존재하지 않는 값은 제외)
 *  - Language[] 배열을 number[]로 변환합니다.
 */
export function mapLanguagesNum(langs?: Language[]): number[] {
  return (langs ?? [])
    .map((id) => LANGUAGE_NUM_MAP[id])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}


/* ──────────────────────────────────────────────
// 사용 예시 코드
// ──────────────────────────────────────────────

// number[] → Language[]
const ids = [0, 2, 99];
const langs = mapLanguages(ids);
// 결과: ["C", "Python"]

// Language[] → number[]
const selected: Language[] = ["C++", "Java"];
const idsBack = mapLanguagesNum(selected);
// 결과: [1, 3]

// 대소문자 무시 변환
// console.log(toLanguage("python"));  // "Python"
// console.log(toLanguage("JAVA"));    // "Java"
// console.log(toLanguage("rust"));    // undefined

// 타입 안정성 보장
function setLang(lang: Language) {
  // console.log("선택된 언어:", lang);
}
setLang(LANGUAGES.CPP);  // OK
setLang("Rust");         // 컴파일 에러
*/
