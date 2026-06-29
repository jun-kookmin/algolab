"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Lecture,
  useGetLecture,
} from "@/hooks/lectures/Get/useGetLecture";
import {
  LectureMembersResponse,
  useGetLectureMembers,
} from "@/hooks/lectures/Get/useGetLectureMembers";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

const StudentManageTab = dynamic(() => import("@/app/class/[classid]/classmanage/StudentManageTab"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-gray-500">학생관리 로딩 중...</div>
  ),
});

const SubmitInfoTab = dynamic(() => import("@/app/class/[classid]/classmanage/SubmitInfoTab"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-gray-500">제출정보 로딩 중...</div>
  ),
});

const StudentActivityTab = dynamic<{
  lectureStartDate?: string | null;
  lectureEndDate?: string | null;
}>(() => import("@/app/class/[classid]/classmanage/StudentActivityTab"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-gray-500">활동집계 로딩 중...</div>
  ),
});

type MainTab = "student" | "submit" | "activity";
type SubmitCategory = "HOMEWORK" | "EXAM";
type ExamView = "problem" | "exam";

export default function ClassManageClient({
  initialLecture,
  initialMembers,
}: {
  initialLecture?: Lecture;
  initialMembers?: LectureMembersResponse;
}) {
  const [activeTab, setActiveTab] = useState<MainTab>("student");
  const [submitTab, setSubmitTab] = useState<SubmitCategory>("EXAM");
  const [examView, setExamView] = useState<ExamView>("problem");
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lectureId = String(params.classid ?? "");
  const { data, isLoading, error, refetch } = useGetLectureMembers(lectureId, {
    initialData: initialMembers,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const { data: lecInfo } = useGetLecture(lectureId, {
    initialData: initialLecture,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  const activeTabFromQuery = searchParams.get("tab");
  const submitTabFromQuery = searchParams.get("submitTab");
  const examViewFromQuery = searchParams.get("examView");

  const syncTabParams = (
    nextMainTab: MainTab,
    nextSubmitTab: SubmitCategory,
    nextExamView: ExamView
  ) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", nextMainTab);
    if (nextMainTab === "submit") {
      next.set("submitTab", nextSubmitTab);
      if (nextSubmitTab === "EXAM") {
        next.set("examView", nextExamView);
      } else {
        next.delete("examView");
      }
    } else {
      next.delete("submitTab");
      next.delete("examView");
    }
    router.replace(`${pathname}?${next.toString()}`);
  };

  const setActiveTabSafe = (next: MainTab) => {
    setActiveTab(next);
    syncTabParams(next, submitTab, examView);
  };

  const setSubmitTabSafe = (next: SubmitCategory) => {
    const nextExamView: ExamView = next === "EXAM" ? examView : "problem";
    setSubmitTab(next);
    if (next === "HOMEWORK") {
      setExamView("problem");
    } else {
      setExamView(nextExamView);
    }
    if (activeTab === "submit") {
      syncTabParams("submit", next, next === "HOMEWORK" ? "problem" : nextExamView);
    }
  };

  const setExamViewSafe = (next: ExamView) => {
    setExamView(next);
    if (activeTab === "submit") {
      syncTabParams("submit", submitTab, next);
    }
  };

  useEffect(() => {
    const isStudentTab = activeTabFromQuery === "student";
    const isSubmitTab = activeTabFromQuery === "submit";
    const isActivityTab = activeTabFromQuery === "activity";
    if (!isStudentTab && !isSubmitTab && !isActivityTab) return;

    const nextMainTab: MainTab = isSubmitTab
      ? "submit"
      : isActivityTab
        ? "activity"
        : "student";
    setActiveTab((prev) => (prev === nextMainTab ? prev : nextMainTab));

    if (!isSubmitTab) return;

    const nextSubmitTab =
      submitTabFromQuery === "HOMEWORK" || submitTabFromQuery === "EXAM"
        ? submitTabFromQuery
        : "EXAM";
    setSubmitTab((prev) => (prev === nextSubmitTab ? prev : nextSubmitTab));

    const nextExamView =
      examViewFromQuery === "problem" || examViewFromQuery === "exam"
        ? examViewFromQuery
        : "problem";
    if (nextSubmitTab === "EXAM") {
      setExamView((prev) => (prev === nextExamView ? prev : nextExamView));
    } else {
      setExamView((prev) => (prev === "problem" ? prev : "problem"));
    }
  }, [activeTabFromQuery, submitTabFromQuery, examViewFromQuery]);

  useEffect(() => {
    if (!searchParams.has("tab")) {
      syncTabParams(activeTab, submitTab, examView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderTab = () => {
    if (activeTab === "submit") {
      return (
        <SubmitInfoTab
          data={data?.members}
          lectureName={lecInfo?.name}
          submitTab={submitTab}
          examView={examView}
          onSubmitTabChange={setSubmitTabSafe}
          onExamViewChange={setExamViewSafe}
        />
      );
    }
    if (activeTab === "activity") {
      return (
        <StudentActivityTab
          lectureStartDate={lecInfo?.start_date}
          lectureEndDate={lecInfo?.end_date}
        />
      );
    }
    return (
      <StudentManageTab
        data={data?.members}
        lecInfo={lecInfo}
        isLoading={isLoading}
        error={error}
        refetch={refetch}
      />
    );
  };

  return (
    <section className="h-full flex flex-col overflow-hidden bg-[rgba(237,239,254,1)] font-kr">
      <div className="bg-white pt-3">
        <div className="fluid-container">
          <div className="mb-3 text-sm font-bold text-indigo-700">
            {lecInfo?.name}
          </div>
          <div className="h-px bg-gray-200" />

          <nav className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTabSafe("student")}
              className={`font-kr px-4 py-2 text-2xl md:text-3xl mb-6 font-bold ${
                activeTab === "student"
                  ? "text-gray-800 border-t-2"
                  : "text-gray-400"
              }`}
            >
              학생관리
            </button>
            <button
              onClick={() => setActiveTabSafe("submit")}
              className={`font-kr px-4 py-2 text-2xl md:text-3xl mb-6 font-bold ${
                activeTab === "submit"
                  ? "text-gray-800 border-t-2"
                  : "text-gray-400"
              }`}
            >
              제출정보
            </button>
            <button
              onClick={() => setActiveTabSafe("activity")}
              className={`font-kr px-4 py-2 text-2xl md:text-3xl mb-6 font-bold ${
                activeTab === "activity"
                  ? "text-gray-800 border-t-2"
                  : "text-gray-400"
              }`}
            >
              활동집계
            </button>
          </nav>
        </div>
      </div>

      <div className="w-full flex-1 overflow-auto bg-[rgba(237,239,254,1)]">
        <div className="fluid-container pb-20 pt-6">
          {renderTab()}
        </div>
      </div>
    </section>
  );
}
