"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Question } from "@/types/class";
import ProblemImportModalLeft from "@/components/class/ProblemImportModal/ProblemImportModalLeft";
import ProblemImportModalRight from "@/components/class/ProblemImportModal/ProblemImportModalRight";
import { useGetProblems } from "@/hooks/problems/useGetProblems";
import { useGetProblemsByIds } from "@/hooks/problems/useGetProblem";
import { DIFFICULTY_WEIGHT, ProblemDifficulty } from "@/types/difficulties";

interface ProblemImportModalProps {
    open: boolean;
    initialSelected?: string[];
    onClose: () => void;
    onConfirm: (qs: Question[]) => void; // 내부 상태는 Question[]
}

const ProblemImportModal: React.FC<ProblemImportModalProps> = ({
    open,
    initialSelected = [],
    onClose,
    onConfirm,
}) => {
    const router = useRouter();

    // 내부 상태는 Question[]
    const [selectedOrder, setSelectedOrder] = useState<Question[]>([]);
    const [courseName, setCourseName] = useState("");

    const [page, setPage] = useState(1);
    const itemsPerPage = 10;

    const [searchText, setSearchText] = useState("");
    const [keyword, setkeyword] = useState("");
    
    const params = useMemo(
        () => ({
            page,
            size: itemsPerPage,
            name: (keyword || "").trim(), // ← 검색어 전달
        }),
        [page, itemsPerPage, keyword]
    );

    const { data: rawQuestions } = useGetProblems(params);
    const questions: Question[] = useMemo(
        () => rawQuestions?.problems ?? [],
        [rawQuestions]
    );
    const totalPages = rawQuestions?.total
    ? Math.ceil(rawQuestions.total / itemsPerPage)
    : page;

    // 현재 페이지에 로드된 문제를 빠르게 찾기 위한 맵
    const byIdOnPage = useMemo(() => {
    const m = new Map<string, Question>();
    questions.forEach((q) => m.set(q.id, q));
    return m;
    }, [questions]);

    // 초기 선택된 id들의 상세를 가져온다 (항상 최상위에서 훅 호출)
    const { data: initialDetails } = useGetProblemsByIds(initialSelected, {
        includeTestcases: false,
    });

    // 상세 데이터를 id->Question 맵으로 정리
    const initialDetailMap = useMemo(() => {
    const m = new Map<string, Question>();
    (initialDetails ?? []).forEach((qd) => {
        if (qd) m.set(qd.id, qd);
    });
    return m;
    }, [initialDetails]);

    // 모달이 열릴 때 1회만 초기화
    const initializedRef = useRef(false);
    useEffect(() => {
        if (!open) {
            initializedRef.current = false;
            return;
        }
        if (!initializedRef.current) {
            // initialSelected의 순서를 보존하면서 Question[] 구성
            // 1) 현재 페이지에 있으면 그 객체 사용
            // 2) 없으면 initialDetailMap에서 보충
            const seeded: Question[] = initialSelected
            .map((id) => byIdOnPage.get(id) ?? initialDetailMap.get(id))
            .filter((q): q is Question => Boolean(q));

            setSelectedOrder(seeded);
            initializedRef.current = true;

            // 과목명/코드 추출
            const header = document.querySelector(".text-indigo-700");
            if (header) {
            const name = header.childNodes[0]?.textContent?.trim() || "";
            setCourseName(name);
            }

            // 기타 초기화
            setPage(1);
            setSearchText("");
        }
    }, [open, initialSelected, byIdOnPage, initialDetailMap]);

    // 선택 토글 (객체 배열 기준)
    const toggleSelect = (id: string) => {
    const candidate = byIdOnPage.get(id) ?? initialDetailMap.get(id);
    if (!candidate) return;

    setSelectedOrder((prev) => {
        const exists = prev.some((it) => it.id === id);
        return exists ? prev.filter((it) => it.id !== id) : [...prev, candidate];
    });
    };

    // 순서 위/아래 이동 (객체 배열 기준)
    const moveUp = (id: string) => {
    setSelectedOrder((order) => {
        const idx = order.findIndex((it) => it.id === id);
        if (idx > 0) {
        const updated = [...order];
        [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
        return updated;
        }
        return order;
    });
    };

    const moveDown = (id: string) => {
    setSelectedOrder((order) => {
        const idx = order.findIndex((it) => it.id === id);
        if (idx !== -1 && idx < order.length - 1) {
        const updated = [...order];
        [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
        return updated;
        }
        return order;
    });
    };

    // 난이도 정렬 (객체 배열 기준)
    const toWeight = (d : ProblemDifficulty) => DIFFICULTY_WEIGHT[d] ?? 0;

    const sortByDifficultyAsc = () => {
    setSelectedOrder((order) =>
        [...order].sort((a, b) => toWeight(a.difficulty) - toWeight(b.difficulty))
    );
    };

    const sortByDifficultyDesc = () => {
    setSelectedOrder((order) =>
        [...order].sort((a, b) => toWeight(b.difficulty) - toWeight(a.difficulty))
    );
    };

    // 닫기·확정
    const handleClose = onClose;
    const handleConfirm = () => {
    onConfirm(selectedOrder); // Question[] 그대로 전달
    };

    const modalActionBtnBase =
    "font-kr inline-flex h-9 items-center justify-center rounded-[10px] border px-6 text-sm font-medium active:scale-95";
    const modalSecondaryBtnClass =
    `${modalActionBtnBase} border-indigo-300 bg-white text-indigo-600 hover:bg-indigo-50`;
    const modalPrimaryBtnClass =
    `${modalActionBtnBase} border-[rgba(78,97,246,1)] bg-[rgba(78,97,246,1)] text-white hover:bg-[rgba(55,69,175,1)]`;

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto p-4">
            {/* 배경 */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="relative z-10 flex min-h-full items-start justify-center py-4 sm:items-center">
                {/* 모달 컨테이너 */}
                <div className="font-kr relative flex max-h-[calc(100dvh-2rem)] w-[min(95vw,1400px)] flex-col overflow-hidden rounded-lg bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-b-gray-200 px-6 py-4">
                        <div className="font-kr pt-[2px] text-sm font-bold text-indigo-700">
                            {courseName}
                        </div>
                    </div>
                    <h2 className="font-kr px-8 py-5 text-lg font-bold">문제 편집하기</h2>

                    {/* Body (Left / Right) */}
                    <div className="mx-8 flex flex-1 overflow-hidden border-t border-t-gray-200 py-5">
                        {/* Left */}
                        <ProblemImportModalLeft
                            filteredList={questions}
                            // Left/Right는 기존 시그니처를 유지하기 위해 id 배열로 내려보냄
                            selectedOrder={selectedOrder.map((q) => q.id)}
                            page={page}
                            setPage={setPage}
                            totalPages={totalPages}
                            searchText={searchText}
                            setSearchText={setSearchText}
                            itemsPerPage={itemsPerPage}
                            toggleSelect={toggleSelect}
                            onSearch={() => {                // 검색 버튼/Enter에서 호출
                                setkeyword(searchText);
                                setPage(1);                    // 페이지 리셋
                            }}
                        />

                        {/* Right */}
                        <ProblemImportModalRight
                            selectedOrder={selectedOrder}
                            toggleSelect={toggleSelect}
                            moveUp={moveUp}
                            moveDown={moveDown}
                            sortByDifficultyAsc={sortByDifficultyAsc}
                            sortByDifficultyDesc={sortByDifficultyDesc}
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-3">
                        {/* (A) “문제 생성하기” -> /addProblem 이동 */}
                        <button
                            onClick={() => {
                                router.push("/problem/add");
                            }}
                            className={modalSecondaryBtnClass}
                        >
                            문제 생성하기
                        </button>

                        {/* 취소/저장 */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleClose}
                                className={`${modalSecondaryBtnClass} px-4`}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={modalPrimaryBtnClass}
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProblemImportModal;
