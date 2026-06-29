import { ChevronLeft, ChevronRight } from "lucide-react";

const lectureList = [
  {
    title: "알고리즘 실습 테스트",
    period: "2025.04.07 ~2025.04.25",
  },
  {
    title: "자료구조 실습 테스트",
    period: "2025.04.07 ~2025.04.25",
  },
];

export default function LectureSidebar() {
  return (
    <aside className="w-full shrink-0 bg-white lg:w-[260px]">
      <h2 className="text-[15px] font-semibold text-[#6B7280] mb-[9px]">
        강의 목차
      </h2>

      {/* 상단 네비게이션 바 */}
      <div className="flex items-center justify-between text-[#9CA3AF] text-sm border border-gray-200 rounded-t-md px-4 py-2">
        <ChevronLeft className="w-4 h-4" />
        <span className="text-[13px]">파트 이름</span>
        <ChevronRight className="w-4 h-4" />
      </div>

      {/* 강의 리스트 */}
      <div className="divide-y border border-gray-200 overflow-hidden text-[13px]">
        {lectureList.map((lecture, idx) => (
          <div
            key={idx}
            className={`px-4 py-3 border-gray-200 ${
              idx === 0 ? "bg-[#f9fafb]" : "bg-white"
            }`}
          >
            <div className="text-[#374151] font-semibold">{lecture.title}</div>
            <div className="text-[#9CA3AF] text-xs">{lecture.period}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
