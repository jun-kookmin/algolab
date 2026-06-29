"use client";

import React, { useState } from "react";
import MoreBtn from "@/components/testStudentManage/MoreBtn";
import Image from "next/image";
//

export default function QnaSection() {
  const [questionPage, setQuestionPage] = useState(1);
  const [answerPage, setAnswerPage] = useState(1);

  // 임시 데이터 (페이지별 질문/답변 리스트)
  const questions = new Array(4).fill(null);
  const answers = new Array(4).fill("풀이");

  return (
    <section className="w-full mt-10 rounded-t-[13px] shadow-sm border-[#D9D9D9] bg-white">
      {/* 헤더 */}
      <div className="flex justify-between items-center px-6 py-4 bg-[#F3F4F6]">
        <h2 className="text-[16px] font-semibold text-[#1e1e1e]">질문 풀이</h2>
        <button className="border border-[#9EA2AE] px-6 py-3 rounded-xl text-sm font-medium bg-white">
          질문하기
        </button>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* 질문 리스트 */}
        <div className="px-6 pb-4 border-r border-[#D9D9D9]">
          <div className="flex justify-end items-center h-[42px]">
            <MoreBtn />
          </div>
          {questions.map((_, i) => (
            <div
              key={i}
              className="flex justify-between border border-[#D9D9D9] rounded-md p-4 mb-3 h-[110px]"
            >
              <div className="flex flex-col">
                <div className="flex text-sm font-medium mb-1">
                  질문 {i + 1}
                </div>
                <div className="flex text-sm text-gray-700 font-bold">
                  이거 어케 풀어요? 알려주세요용
                </div>
                <div className="flex text-xs text-gray-400 mt-1">
                  STUDENT001 Student A
                </div>
              </div>
              <div className="flex justify-center items-center w-15 h-[67px] rounded-[6px] border border-[#D9D9D9]">
                <div className="flex flex-col items-center justify-center">
                  <span>{0}</span>
                  <span className="text-[#9EA2AE] text-sm">답변</span>
                </div>
              </div>
            </div>
          ))}

          {/* 질문 페이지네이션 */}
          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={() => setQuestionPage((prev) => Math.max(prev - 1, 1))}
              className="text-blue-600 hover:bg-gray-100 w-6 h-6 flex items-center justify-center rounded"
            >
              <Image
                src="/assets/icon/nav-arrow-left.svg"
                alt="이전"
                width={24}
                height={24}
                className="h-6 w-6"
              />
            </button>
            {[1, 2, 3, 4].map((p) => (
              <button
                key={p}
                className={`w-6 h-6 rounded-full text-sm ${
                  questionPage === p
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                onClick={() => setQuestionPage(p)}
              >
                {p}
              </button>
            ))}
            {/* 다음 페이지 버튼 */}
            <button
              onClick={() => setQuestionPage((prev) => Math.min(prev + 1, 4))}
              className="text-blue-600 hover:bg-gray-100 w-6 h-6 flex items-center justify-center rounded"
            >
              <Image
                src="/assets/icon/nav-arrow-right.svg"
                alt="다음"
                width={24}
                height={24}
                className="h-6 w-6"
              />
            </button>
          </div>
        </div>

        {/* 답변 리스트 */}
        <div className="px-6 pb-4 bg-[#f5f6f8] min-h-[420px]">
          <div className="flex justify-end items-center h-[42px]">
            <MoreBtn />
          </div>
          {answers.length ? (
            <>
              {answers.map((a, i) => (
                <div
                  key={i}
                  className="bg-white rounded-md p-4 mb-3 text-sm shadow-sm h-[110px]"
                >
                  풀이 {i + 1}
                </div>
              ))}

              {/* 답변 페이지네이션 */}
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={() => setAnswerPage((prev) => Math.max(prev - 1, 1))}
                  className="text-blue-600 hover:bg-gray-100 w-6 h-6 flex items-center justify-center rounded"
                >
                  <Image
                    src="/assets/icon/nav-arrow-left.svg"
                    alt="이전"
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </button>
                {[1, 2, 3, 4].map((p) => (
                  <button
                    key={p}
                    className={`w-6 h-6 rounded-full text-sm ${
                      answerPage === p
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:bg-gray-200"
                    }`}
                    onClick={() => setAnswerPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setAnswerPage((prev) => Math.min(prev + 1, 4))}
                  className="text-blue-600 hover:bg-gray-100 w-6 h-6 flex items-center justify-center rounded"
                >
                  <Image
                    src="/assets/icon/nav-arrow-right.svg"
                    alt="다음"
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              문제 해결 시 열람 가능합니다.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
