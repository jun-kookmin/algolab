"use client";

import React, { useState, useMemo } from "react";
import { CompletedItem } from "@/types/testManage";

interface Props {
    items: CompletedItem[];
    lectureId?: string;
    examId?: string;
}

type SortKey = "name" | "id" | "none";
type SortOrder = "asc" | "desc" | "none";

const StudentListRenderer: React.FC<Props> = ({ items, lectureId, examId }) => {
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

    const sortedItems = useMemo(() => {
        if (sortKey === "none" || sortOrder === "none") return items;

        const newArr = [...items];
        newArr.sort((a, b) => {
            let av, bv;
            if (sortKey === "name") {
                av = a.name;
                bv = b.name;
            } else if (sortKey === "id") {
                av = a.id;
                bv = b.id;
            } else {
                av = "";
                bv = "";
            }
            if (av < bv) return -1;
            if (av > bv) return 1;
            return 0;
        });
        if (sortOrder === "desc") newArr.reverse();
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
        <div className="font-kr px-1 pt-4">
            <div className="overflow-auto">
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
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sortedItems.map((item, idx) => {
                            const isLongName = item.name.length > 4;
                            const displayName = isLongName
                                ? `${item.name.slice(0, 4)}...`
                                : item.name;

                            return (
                                <tr
                                    key={idx}
                                    className="hover:bg-gray-50"
                                onClick={() => window.open(buildSubmissionUrl(item), "_blank")}
                                >
                                    <td className="px-2 py-2 text-gray-500">{idx + 1}</td>

                                    {/* 이름 셀 */}
                                    <td className={`px-2 py-2 whitespace-nowrap ${isLongName ? "group relative" : ""}`}>
                                        {displayName}
                                        {isLongName && (
                                            <div className="absolute left-0 -top-6 z-10 hidden whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                                                {item.name}
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-2 py-2">{item.id}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StudentListRenderer;
