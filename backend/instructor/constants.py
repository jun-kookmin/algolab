from __future__ import annotations

LANGUAGE_INDEX = {
    "C": 0,
    "C++": 1,
    "Python": 2,
    "Java": 3,
}
INDEX_TO_LANGUAGE = {v: k for k, v in LANGUAGE_INDEX.items()}

# Legacy/동일어/입력 변형 지원용
LANG_KEY_TO_DBNAME = {
    "cpp": "C++",
    "c": "C",
    "python": "Python",
    "java": "Java",
}

_LANG_NAME_ALIASES = {
    "c": "C",
    "cpp": "C++",
    "c++": "C++",
    "cc": "C++",
    "cxx": "C++",
    "python": "Python",
    "py": "Python",
    "python3": "Python",
    "java": "Java",
}


def normalize_language_name(raw_value):
    """입력값을 언어 canonical name(C / C++ / Python / Java)으로 정규화한다."""
    if raw_value is None:
        return None

    if isinstance(raw_value, bool):
        return None

    if isinstance(raw_value, int):
        return INDEX_TO_LANGUAGE.get(raw_value)

    text = str(raw_value).strip()
    if not text:
        return None

    lower = text.lower()

    if lower in _LANG_NAME_ALIASES:
        return _LANG_NAME_ALIASES[lower]

    # 프론트에서 넘어오는 0/1/2/3처럼 문자열 정수도 지원
    if lower.isdigit():
        idx = int(lower)
        return INDEX_TO_LANGUAGE.get(idx)

    canonical_map = {
        "c": "C",
        "c++": "C++",
        "python": "Python",
        "java": "Java",
    }
    if lower in canonical_map:
        return canonical_map[lower]

    # DB 표기 그대로 들어오면 보존
    normalized = text.replace(" ", "")
    return normalized if normalized in INDEX_TO_LANGUAGE else None


def language_index(raw_name):
    """언어 문자열/인덱스/별칭을 받아 표준 인덱스(0~3)를 반환."""
    name = normalize_language_name(raw_name)
    if name is None:
        return None
    return LANGUAGE_INDEX.get(name)


DIFFICULTY_MAP_OUT = {1: "EASY", 2: "MEDIUM", 3: "HARD"}
DIFFICULTY_MAP_IN = {v: k for k, v in DIFFICULTY_MAP_OUT.items()}

TYPE_MAP_OUT = {"PS": "GENERAL", "PC": "CHECKER"}
TYPE_MAP_IN = {v: k for k, v in TYPE_MAP_OUT.items()}
