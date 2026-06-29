"use client";

import React from "react";

interface Props {
  isActive: boolean;
  onClickOAuth: () => void;
}

const OAuthLoginForm: React.FC<Props> = ({
  isActive,
  onClickOAuth,
}) => {
  return (
    <div
      className={`flex h-[272px] flex-col justify-between overflow-hidden px-1 py-1 transition-opacity duration-600
    ${
      isActive
        ? "opacity-100 pointer-events-auto"
        : "opacity-0 pointer-events-none"
    }`}
    >
      {/* 상단 안내 */}
      <div className="mt-2 space-y-4">
        <h2 className="text-xl font-bold text-gray-800">Algolab 로그인</h2>

        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          알고리즘 과제 제출 · 자동 채점 · 시험 응시 서비스를 이용하려면 <br />
          OAuth로 로그인하세요.
        </p>

        <ul className="text-xs text-gray-500 space-y-1 mt-3">
          <li>✔ 과제 업로드 및 제출 내역 확인</li>
          <li>✔ 자동 채점 결과 및 통계 제공</li>
          <li>✔ 온라인 시험 응시 기능 지원</li>
        </ul>
      </div>

      {/* 버튼 영역 */}
      <div className="mt-4 mb-2 flex flex-col gap-2">
        <button
          type="button"
          className="font-eng font-semibold w-full py-3 bg-[#7181f8] text-white rounded-md cursor-pointer"
          onClick={onClickOAuth}
        >
          OAuth 로그인
        </button>
      </div>
    </div>
  );
};

export default OAuthLoginForm;
