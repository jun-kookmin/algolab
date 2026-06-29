"use client";

import React from "react";
import Image from "next/image";

/* ──────────────────────────────────────────
 * ① 평균점수 카드 – 배경 Illustration
 * ────────────────────────────────────────── */
const ScoreCard = () => (
  <div className="relative overflow-hidden rounded-lg border bg-[url('/assets/icon/Image_TestScore.svg')] bg-contain bg-right-top bg-no-repeat px-4 py-5">
    <div className="pointer-events-none absolute right-0 top-0 h-full w-32 opacity-90" />
    <p className="mb-1 flex items-center gap-1 text-sm font-semibold text-gray-600">
      평균점수
    </p>
    <div className="text-xl font-bold text-indigo-600">
      98점 <span className="ml-1 text-sm text-gray-400">/ 100점</span>
    </div>
  </div>
);

/* ──────────────────────────────────────────
 * ② 공통 카드 – 아이콘(16px) + 텍스트
 * ────────────────────────────────────────── */
const StatCard = ({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: string;
}) => (
  <div className="rounded-lg border px-4 py-5">
    {/* 제목 + 아이콘 */}
    <p className="mb-1 flex items-center gap-1 text-sm font-semibold text-gray-600">
      <Image src={icon} alt="" width={16} height={16} />
      {title}
    </p>

    {/* 수치 */}
    <div className="text-xl font-bold text-indigo-600">
      {value}
      {sub && <span className="ml-1 text-sm text-gray-400">{sub}</span>}
    </div>
  </div>
);

const TestResultRight: React.FC = () => (
  <div className="font-kr space-y-4 text-sm text-gray-700">
    <h2 className="mb-1 text-base font-bold text-gray-800">우리 분반 평균</h2>

    <ScoreCard />

    <StatCard
      title="평균 소요 시간"
      value="124분"
      sub="/ 170분"
      icon="/assets/icon/Icon_EverageTime.svg"
    />
    <StatCard
      title="최고 정답률 / 최저 정답률"
      value="98%"
      sub=" / 34%"
      icon="/assets/icon/Icon_Medal.svg"
    />
    <StatCard
      title="평균 제출 횟수"
      value="13회"
      icon="/assets/icon/Icon_SubmitCount.svg"
    />
  </div>
);

export default TestResultRight;
