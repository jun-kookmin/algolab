"use client";

import React from "react";
import TestResultLeft from "@/components/testResult/TestResultLeft";
import TestResultRight from "@/components/testResult/TestResultRight";
import StudentListRenderer from "@/components/testManage/StudentListRenderer";
import { CompletedItem } from "@/types/testManage"; // 없어도 되면 아래에 직접 선언해도 OK

/** ─────────────────────────────────────────
 *  더미 학생 목록 – 필요한 만큼 추가/수정
 *  ───────────────────────────────────────── */
const dummyStudentList: CompletedItem[] = [
  { name: "Student A", id: "STUDENT001", statuses: [], ip: "-", startTime: "-" },
  { name: "Student B", id: "STUDENT002", statuses: [], ip: "-", startTime: "-" },
  { name: "Student C", id: "STUDENT003", statuses: [], ip: "-", startTime: "-" },
  { name: "Student D", id: "STUDENT004", statuses: [], ip: "-", startTime: "-" },
  { name: "Student E", id: "STUDENT005", statuses: [], ip: "-", startTime: "-" },
  { name: "Student F", id: "STUDENT006", statuses: [], ip: "-", startTime: "-" },
];

const TestResultPage: React.FC = () => {
  return (
    <section className="fluid-container flex min-h-screen flex-col bg-white pb-20 pt-3">
      {/* ── 과목 + 코드 헤더 ───────────────── */}
      <div className="font-kr mb-3 pt-[2px] text-sm font-bold text-indigo-700">
        C++ 프로그래밍
        <span className="ml-2 text-gray-400">COURSE-001</span>
      </div>
      <div className="h-px bg-gray-200 shadow" />

      {/* ── 페이지 타이틀 ──────────────────── */}
      <h1 className="font-kr mb-6 mt-10 text-4xl font-bold text-gray-800">
        시험 결과 관리
      </h1>
      <p className="font-kr mb-10 text-sm text-gray-500">
        응시, 미응시 학생들을 확인하고 결과를 볼 수 있습니다.
      </p>

      {/* ── 본문 3단 레이아웃 ──────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-10">
        {/* ① 왼쪽 : 개별 학생 결과 */}
        <div className="flex-1">
          <TestResultLeft />
        </div>

        {/* ② 가운데 : 우리 분반 평균 카드 */}
        <div className="w-full shrink-0 lg:w-64">
          <TestResultRight />
        </div>

        {/* ③ 오른쪽 : 학생 리스트 + 검색 */}
        <aside className="w-full shrink-0 lg:w-60">
          <input
            type="text"
            placeholder="이름, 학번"
            className="mb-4 w-full rounded-md border px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
          />
          {/* 카테고리 탭 – UI 목적용, 동적처리는 이후 단계에서 */}
          <div className="mb-2 flex gap-3 text-sm font-semibold">
            <button className="text-indigo-600">전체(40)</button>
            <button className="text-gray-400">응시(26)</button>
            <button className="text-gray-400">미응시(14)</button>
          </div>

          <StudentListRenderer items={dummyStudentList} />
        </aside>
      </div>
    </section>
  );
};

export default TestResultPage;
