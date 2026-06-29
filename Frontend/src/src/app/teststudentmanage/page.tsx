"use client";

import React from "react";
import LectureSidebar from "@/components/testStudentManage/LectureSidebar";
import TestInfoBox from "@/components/testStudentManage/TestInfoBox";
import TestHeader from "@/components/testStudentManage/TestHeader";
import QnaSection from "@/components/testStudentManage/QnaSection";

const Page = () => {
  return (
    <section className="fluid-container flex flex-col bg-white pb-20 font-kr">
      {/* 헤더 영역 */}
      <div className="mb-6 flex items-center h-10 w-full bg-white shadow-sm pt-[10px] pb-[8px]">
        <div className="text-base text-[#2B3587] font-semibold mr-[30px]">
          C++ 프로그래밍
        </div>
        <div className="text-base text-[#9EA2AE]">COURSE-001</div>
      </div>
      <div className="mt-6 flex w-full flex-col gap-6 lg:flex-row lg:gap-6">
        {/* 메인 영역 */}
        <div className="flex-1">
          <TestHeader />
          <TestInfoBox
            totalQuestions={2}
            totalScore={100}
            timeLimit={120}
            dateSchedule="25.07.11 (0:00:00 - 23:59:59)"
          />
          <QnaSection />
        </div>

        {/* 사이드바 */}
        <LectureSidebar />
      </div>
    </section>
  );
};

export default Page;
