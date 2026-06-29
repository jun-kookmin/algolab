"use client";

import ProblemListRenderer from "@/components/problemManage/ProblemListRenderer";
import type { Problem } from "@/types/problem";
import { useGetProblems, type GetProblemsParams } from "@/hooks/problems/useGetProblems";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

/** "YYYY-MM-DD (HH:mm:ss)" 포맷터 */
const fmtDateTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} (${HH}:${MM}:${SS})`;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const ProblemManagePage: React.FC = () => {
  const router = useRouter();

  // 입력창 값
  const [q, setQ] = useState("");
  // 실제 검색 트리거(아이콘 클릭/Enter로 확정)
  const [search, setSearch] = useState("");

  // UI용 페이징 (검색 유무와 무관하게 UI는 이 값을 사용)
  const [page, setPage] = useState(1); // 1-based
  const [size, setSize] = useState(20); // 화면에 보여줄 개수

  // 검색 제출
  const submitSearch = useCallback(
    (e?: React.FormEvent | React.MouseEvent) => {
      if (e) e.preventDefault();
      const next = q.trim();
      setSearch(next);
      setPage(1); // 새 검색은 1페이지부터
    },
    [q]
  );

  // 서버 검색/페이지네이션 사용 (name: 문제명/설명 검색)
  const params = useMemo<GetProblemsParams>(() => {
    const next: GetProblemsParams = { page, size };
    if (search) next.name = search;
    return next;
  }, [page, size, search]);
  // TODO : Type 변환하기. dfficulties랑 languages 사용하기
  const { data, isLoading, isError } = useGetProblems(params);

  // 서버 응답 형태 흡수: [], {problems:[]}, {data:[]}
  const raw = data as any;
  const rawList: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.problems)
    ? raw.problems
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  const totalForUI =
    typeof raw?.total === "number" ? raw.total : rawList.length;
  const pageForUI = typeof raw?.page === "number" ? raw.page : page;
  const sizeForUI = typeof raw?.size === "number" ? raw.size : size;
  const pageCountForUI = Math.max(
    1,
    Math.ceil((totalForUI || 0) / (sizeForUI || 1))
  );
  const listForUI = rawList;

  // API → UI 타입 매핑 (problem_name → title)
  const uiProblems: Problem[] = useMemo(
    () =>
      listForUI.map((it) => ({
        id: it.id,
        title: it.title ?? it.problem_name ?? "",
        difficulty: it.difficulty,
        isExam: !!it.is_exam,
        openDate: "",
        startDate: fmtDateTime(it.start_date),
        endDate: fmtDateTime(it.end_date),
        canEdit: Boolean(it.canEdit),
        makerName: it.makerName ?? "",
      })),
    [listForUI]
  );

  // 페이지 크기 바꾸면 1페이지로 리셋
  const onChangeSize = (next: number) => {
    setSize(next);
    setPage(1);
  };

  const sizeDropdownRef = useRef<HTMLDivElement | null>(null);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sizeDropdownRef.current &&
        !sizeDropdownRef.current.contains(event.target as Node)
      ) {
        setSizeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startIdx = totalForUI === 0 ? 0 : (pageForUI - 1) * sizeForUI + 1;
  const endIdx = Math.min(pageForUI * sizeForUI, totalForUI || 0);

  // ✅ 행 단위 수정 버튼 핸들러: 라우팅
  const handleRowEdit = useCallback(
    (id: string) => {
      router.push(`/problem/${id}/edit`);
    },
    [router]
  );

  return (
    <section className="h-full flex flex-col overflow-hidden">
      <div className="bg-white pt-3">
        <div className="fluid-container">
          {/* ── 과목 + 코드 헤더 ───────────────── */}
          <div className="font-kr mb-3 pt-[2px] text-sm font-bold text-indigo-700">
            문제 관리
          </div>
          <div className="h-px bg-gray-200 shadow" />

          {/* ── 타이틀 ─────────────────────────── */}
          <h1 className="font-kr mb-6 mt-10 text-[clamp(1.8rem,2.5vw,2.25rem)] font-bold text-gray-800">
            문제 관리
          </h1>
          <p className="font-kr mb-2 text-sm text-gray-500">
            문제를 생성하고 확인, 삭제, 수정가능합니다.
          </p>

          {/* ── 탭 & 액션 바 ────────────────────── */}
          <div className="flex items-center justify-end pb-4">
            {/* 우측 액션 + 검색 */}
            <div className="flex items-center gap-3">
              {/* 검색: 아이콘 클릭/Enter로 submit */}
              <form className="relative w-[clamp(180px,16vw,240px)]" onSubmit={submitSearch}>
                <input
                  type="text"
                  placeholder="제목/본문 검색"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="fluid-control-h w-full rounded-md border border-gray-200 bg-white px-3 pr-10 text-[clamp(11px,0.72vw,13px)] outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  aria-label="검색"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded hover:bg-gray-100 active:scale-95"
                >
                  <img
                    src="/assets/icon/Icon_Search.svg"
                    alt=""
                    className="h-4 w-4 opacity-70 hover:opacity-100"
                  />
                </button>
              </form>

              <button
                className="font-kr fluid-control-h rounded-[10px] border border-indigo-300 bg-white px-[clamp(14px,1.1vw,20px)] text-[clamp(11px,0.72vw,13px)] font-medium text-indigo-600 hover:bg-indigo-50 active:scale-95"
                onClick={() => router.push("/problem/add")}
              >
                문제 생성
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex-1 overflow-auto bg-[rgba(237,239,254,1)]">
        <div className="fluid-container pb-10 pt-4">
          <div className="flex flex-col gap-4">
            {/* ── 탭 아래 스티키 바: 요약/페이지크기/페이저 ───────────────── */}
            {!isLoading && !isError && (
              <div className="overflow-visible rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* 요약 + 페이지 크기 */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-xs text-gray-600">
                      총 <b>{totalForUI}</b>개 / {startIdx}–{endIdx} 표시
                      {search && (
                        <span className="ml-2 text-gray-400">검색어: “{search}”</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">페이지 크기</span>
                      <div className="relative" ref={sizeDropdownRef}>
                        <button
                          type="button"
                          className="inline-flex fluid-control-h min-w-[clamp(64px,5vw,80px)] items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2 text-[clamp(11px,0.72vw,13px)]"
                          onClick={() => setSizeDropdownOpen((prev) => !prev)}
                        >
                          <span>{size}개</span>
                          <span className="text-[10px] text-gray-500">▼</span>
                        </button>
                        {sizeDropdownOpen && (
                          <div className="absolute left-0 top-full z-40 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                            {PAGE_SIZE_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                  className={`fluid-control-h w-full px-2 text-left text-[clamp(11px,0.72vw,13px)] ${
                                  size === opt
                                    ? "bg-gray-100 font-semibold"
                                    : "hover:bg-gray-100"
                                }`}
                                onClick={() => {
                                  onChangeSize(opt);
                                  setSizeDropdownOpen(false);
                                }}
                              >
                                {opt}개
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 페이저 */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="font-kr fluid-control-h rounded-[10px] border border-gray-300 bg-white px-[clamp(10px,0.9vw,14px)] text-[clamp(11px,0.72vw,13px)] text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pageForUI <= 1}
                    >
                      이전
                    </button>

                    {Array.from({ length: pageCountForUI }).map((_, i) => {
                      const n = i + 1;
                      const near =
                        n === 1 ||
                        n === pageCountForUI ||
                        Math.abs(n - pageForUI) <= 2;

                      if (!near) {
                        if (n === 2 && pageForUI > 4) return <span key={n}>…</span>;
                        if (
                          n === pageCountForUI - 1 &&
                          pageForUI < pageCountForUI - 3
                        )
                          return <span key={n}>…</span>;
                        return null;
                      }

                      const active = n === pageForUI;
                      return (
                        <button
                          key={n}
                          className={`font-kr fluid-control-h rounded-[10px] border px-[clamp(10px,0.9vw,14px)] text-[clamp(11px,0.72vw,13px)] transition-colors active:scale-95 disabled:cursor-default ${
                            active
                              ? "bg-indigo-50 text-indigo-700 border-indigo-500 shadow-sm ring-1 ring-indigo-200 font-semibold"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-indigo-50"
                          }`}
                          onClick={() => setPage(n)}
                          disabled={active}
                        >
                          {n}
                        </button>
                      );
                    })}

                    <button
                      className="font-kr fluid-control-h rounded-[10px] border border-gray-300 bg-white px-[clamp(10px,0.9vw,14px)] text-[clamp(11px,0.72vw,13px)] text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                      onClick={() => setPage((p) => Math.min(pageCountForUI, p + 1))}
                      disabled={pageForUI >= pageCountForUI}
                    >
                      다음
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── 문제 목록 ───────────────────────── */}
            <div className="pb-4">
              {isLoading && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
                  문제 목록을 불러오는 중...
                </div>
              )}
              {isError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600 shadow-sm">
                  문제 목록을 불러오지 못했습니다.
                </div>
              )}
              {!isLoading && !isError && (
                <ProblemListRenderer problems={uiProblems} onEdit={handleRowEdit} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemManagePage;
