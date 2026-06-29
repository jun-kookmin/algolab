"use client";

import React, { useState, useMemo } from "react";
import AssignmentStatus from "@/components/testManage/AssignmentStatus";
import { CompletedItem } from "@/types/testManage";

interface Props {
    items: CompletedItem[];
    lectureId?: string;
    examId?: string;
}

type SortKey = "name" | "id" | "startTime" | "status" | "none";
type SortOrder = "asc" | "desc" | "none";

const InProgressListRenderer: React.FC<Props> = ({ items, lectureId, examId }) => {
    const [sortKey, setSortKey] = useState<SortKey>("none");
    const [sortOrder, setSortOrder] = useState<SortOrder>("none");

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            if (sortOrder === "none") {
                setSortOrder("asc");
            } else if (sortOrder === "asc") {
                setSortOrder("desc");
            } else if (sortOrder === "desc") {
                setSortOrder("none");
            }
        } else {
            setSortKey(key);
            setSortOrder("asc");
        }
    };

    /** 상태 비교 함수 (맞춘 문제 개수 desc, 미제출 asc, 등등) */
    function compareStatuses(a: CompletedItem, b: CompletedItem): number {
        const correctA = (a.statuses || []).filter((s) => s === "correct").length;
        const correctB = (b.statuses || []).filter((s) => s === "correct").length;
        if (correctA !== correctB) return correctB - correctA; // 내림차순

        const notA = (a.statuses || []).filter((s) => s === "none").length;
        const notB = (b.statuses || []).filter((s) => s === "none").length;
        if (notA !== notB) return notA - notB; // 오름차순

        // 상태 배열 왼→오 비교
        function rankStatus(s: string) {
            if (s === "correct") return 0;
            if (s === "none") return 1;
            return 2; // 기타
        }
        const arrA = a.statuses || [];
        const arrB = b.statuses || [];
        const maxLen = Math.max(arrA.length, arrB.length);
        for (let i = 0; i < maxLen; i++) {
            const sA = arrA[i] || "";
            const sB = arrB[i] || "";
            if (sA === sB) continue;
            const rA = rankStatus(sA);
            const rB = rankStatus(sB);
            if (rA !== rB) return rA - rB;
        }

        // 모두 동일 → 학번(id) asc
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
    }

    const sortedItems = useMemo(() => {
        if (sortKey === "none" || sortOrder === "none") {
            return items;
        }

        const newArr = [...items];

        newArr.sort((a, b) => {
            let result = 0;
            switch (sortKey) {
                case "name":
                    result = a.name.localeCompare(b.name);
                    break;
                case "id":
                    result = a.id.localeCompare(b.id);
                    break;
                case "startTime":
                    result = (a.startTime || "").localeCompare(b.startTime || "");
                    break;
                case "status":
                    result = compareStatuses(a, b);
                    break;
                default:
                    result = 0;
            }
            if (sortOrder === "asc") return result;
            if (sortOrder === "desc") return -result;
            return 0;
        });

        return newArr;
    }, [items, sortKey, sortOrder]);


    const buildSubmissionUrl = (item: CompletedItem) => {
        const userKey = item.userId ?? item.id;
        const params = new URLSearchParams();
        if (lectureId) params.set("lid", lectureId);
        if (examId) params.set("examId", examId);
        if (lectureId || examId) params.set("tab", "exam");
        const qs = params.toString();
        return qs ? `/submission/${userKey}?${qs}` : `/submission/${userKey}`;
    };

    return (
        <div className="font-kr p-4">
            <table className="min-w-full table-auto">
                <thead>
                    <tr>
                        <th className="px-2 py-2"></th>

                        <th className="px-2 py-2 text-left font-semibold text-gray-700 cursor-pointer"
                            onClick={() => handleSort("name")}
                        >
                            이름
                            {sortKey === "name" && sortOrder !== "none" && ` (${sortOrder})`}
                        </th>

                        <th className="px-2 py-2 text-left font-semibold text-gray-700 cursor-pointer"
                            onClick={() => handleSort("id")}
                        >
                            학번
                            {sortKey === "id" && sortOrder !== "none" && ` (${sortOrder})`}
                        </th>

                        <th className="px-2 py-2 text-left font-semibold text-gray-700 cursor-pointer"
                            onClick={() => handleSort("status")}
                        >
                            상태
                            {sortKey === "status" && sortOrder !== "none" && ` (${sortOrder})`}
                        </th>

                        <th className="px-2 py-2 text-left font-semibold text-gray-700 cursor-pointer"
                        >
                            IP
                        </th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700 cursor-pointer"
                            onClick={() => handleSort("startTime")}
                        >
                            시작 시간
                            {sortKey === "startTime" && sortOrder !== "none" && ` (${sortOrder})`}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {sortedItems.map((item, idx) => {
                        const isLongIp = item.ip.length > 14;
                        const displayIp = isLongIp ? `${item.ip.slice(0, 15)}...` : item.ip;
                        const isLongName = item.name.length > 4;
                        const displayName = isLongName
                            ? `${item.name.slice(0, 4)}...`
                            : item.name;

                        return (
                            <tr
                                key={idx}
                                className="hover:bg-gray-50 border-gray-200"
                                onClick={() => window.open(buildSubmissionUrl(item), "_blank")}
                            >
                                <td className="px-1 py-2 text-gray-500">{idx + 1}</td>

                                <td className={`px-2 py-2 whitespace-nowrap ${isLongName ? "group relative" : ""}`}>
                                    {displayName}
                                    {isLongName && (
                                        <div className="absolute left-0 -top-6 z-10 hidden whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                                            {item.name}
                                        </div>
                                    )}
                                </td>

                                <td className="px-2 py-2">{item.id}</td>

                                <td className="px-2 py-2">
                                    <AssignmentStatus statuses={item.statuses} />
                                </td>

                                <td className={`px-2 py-2 whitespace-nowrap text-gray-700 ${isLongIp ? "group relative" : ""}`}>
                                    {displayIp}
                                    {isLongIp && (
                                        <div className="absolute left-0 -top-8 z-10 hidden whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                                            {item.ip}
                                        </div>
                                    )}
                                </td>

                                <td className="px-2 py-2 text-left text-gray-700">
                                    {item.startTime}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default InProgressListRenderer;
