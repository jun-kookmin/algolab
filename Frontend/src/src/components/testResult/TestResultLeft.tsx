"use client";

import React from "react";
import Image from "next/image";

const TestResultLeft: React.FC = () => {
  return (
    <div className="rounded-xl border border-gray-200 p-8">
      {/* ── 프로필 ───────────────────────── */}
      <div className="mb-8 flex items-center gap-6">
        <Image
          src="/assets/icon/Image_TestScore.svg"
          alt="avatar"
          width={72}
          height={72}
          className="rounded-full"
        />
        <div>
          <p className="text-lg font-bold text-gray-800">Student A</p>
          <p className="text-sm text-gray-400">STUDENT001 · Computer Science</p>
        </div>
      </div>

      {/* ── 결과 관리 ─────────────────────── */}
      <div className="space-y-6 font-kr text-sm">
        {/* 미응시 */}
        <section>
          <header className="mb-1 font-semibold text-gray-700">미응시 (1)</header>
          <div className="flex items-center rounded-md border px-4 py-3">
            <input type="checkbox" className="mr-4 h-4 w-4 accent-indigo-600" />
            <span className="w-20 text-gray-500">문제 3</span>
            <span className="text-gray-600">너무 어려워서 못 푼 문제</span>
          </div>
        </section>

        {/* 오답 */}
        <section>
          <header className="mb-1 font-semibold text-gray-700">오답 (1)</header>
          <div className="flex items-center rounded-md border bg-gray-50 px-4 py-3">
            <input type="checkbox" className="mr-4 h-4 w-4 accent-indigo-600" />
            <span className="w-20 text-gray-500">문제 5</span>
            <span className="flex-1 text-gray-600">성심당 찾아가기</span>
            <span className="text-xs text-gray-400">시간초과</span>
          </div>
        </section>

        {/* 정답 */}
        <section>
          <header className="mb-1 font-semibold text-gray-700">정답 (3)</header>
          <div className="space-y-2 rounded-md border bg-indigo-50/30 px-4 py-3">
            {[
              ["문제 2", "KTX에서 무궁화호로 갈아타기"],
              ["문제 3", "완룐카샤"],
              ["문제 4", "식충식물로 하루에 몇 마리의 초파리를 잡을 수 있나"],
            ].map(([num, desc]) => (
              <div key={num} className="flex items-center">
                <input type="checkbox" className="mr-4 h-4 w-4 accent-indigo-600" />
                <span className="w-20 text-gray-500">{num}</span>
                <span className="text-gray-700">{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TestResultLeft;
