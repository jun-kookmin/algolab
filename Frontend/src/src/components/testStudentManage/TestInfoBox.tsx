interface TestInfoBoxProps {
  totalQuestions: number;
  totalScore: number;
  timeLimit: number;
  dateSchedule: string;
}

export default function TestInfoBox({
  totalQuestions,
  totalScore,
  timeLimit,
  dateSchedule,
}: TestInfoBoxProps) {
  return (
    <div className="w-full min-h-[132px]">
      {/* 섹션 제목 */}
      <h2 className="text-[18px] font-bold text-gray-900 mb-4">테스트 안내</h2>

      {/* 기본 정보 테이블 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 text-left px-2 sm:pl-[25px] bg-[#F7FBFF] rounded-t-md overflow-hidden">
        <div className="flex flex-col justify-between py-3">
          <span className="text-sm text-[#9EA2AE]">문제</span>
          <span className="font-semibold text-black">
            총 {totalQuestions} 문제
          </span>
        </div>
        <div className="flex flex-col justify-between py-3">
          <span className="text-sm text-[#9EA2AE]">문제</span>
          <span className="font-semibold">{totalScore} 점</span>
        </div>
        <div className="flex flex-col justify-between py-3">
          <span className="text-sm text-[#9EA2AE]">제한시간</span>
          <span className="font-semibold">{timeLimit} 분</span>
        </div>
        <div className="flex flex-col col-span-1 sm:col-span-2 lg:col-span-2 justify-between py-3">
          <span className="text-sm text-[#9EA2AE]">응시 제한 스케줄</span>
          <span className="font-semibold">{dateSchedule}</span>
        </div>
      </div>

      {/* 문제 안내 박스 */}
      <div className="mt-4 border border-gray-200 rounded-md px-6 py-4 text-sm text-gray-700 leading-relaxed">
        <div className="font-semibold mb-2">문제 안내</div>
        <ol className="list-decimal ml-5 space-y-2">
          <li>
            백엔드
            <ul className="list-disc ml-5 text-gray-600">
              <li>Java 코딩테스트 및 SQL 테스트가 진행됩니다.</li>
              <li>프로그래밍은 기준 Lv1~2로 구성 / 총 4문제, 4시간 응시</li>
            </ul>
          </li>
          <li>
            프론트엔드
            <ul className="list-disc ml-5 text-gray-600">
              <li>JavaScript 코딩테스트가 진행됩니다.</li>
              <li>프로그래밍은 기준 Lv1 2문제, Lv2 1문제 / 3시간 응시</li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  );
}
