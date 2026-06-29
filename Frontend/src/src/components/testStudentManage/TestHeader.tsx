export default function TestHeader() {
  return (
    <div className="mb-8">
      {/* 돌아가기 링크 */}
      <button className="text-sm text-[#448AFF] mb-1 hover:underline">
        ← 커리큘럼으로 돌아가기
      </button>

      {/* 제목 */}
      <h1 className="text-[22px] font-semibold text-gray-900">
        [기말고사] 성심당 찾아가기
      </h1>

      {/* 설명 */}
      <p className="text-sm text-[#6B7280] mt-1">
        2시간 소요 · 문제풀이 / 중간, 기말
      </p>
    </div>
  );
}
