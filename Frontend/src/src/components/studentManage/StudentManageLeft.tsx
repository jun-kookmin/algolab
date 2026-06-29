// ──── FILE: components/StudentManageLeft.tsx ────
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Student } from "@/types/student";
import Image from "next/image";
import { UseQueryResult } from "@tanstack/react-query";
import { LectureMembersResponse } from "@/hooks/lectures/Get/useGetLectureMembers";
import Pagination from "@/components/studentManage/components/Pagination";
import LoadingSpinner from "@/components/studentManage/components/LoadingSpinner";

const Search = "/assets/icon/Icon_Search.svg";
const Down = "/assets/icon/Icon_Down.svg";
const Refresh = "/assets/icon/Icon_Refresh.svg";

interface StudentManageLeftProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  viewSize: number;
  setViewSize: React.Dispatch<React.SetStateAction<number>>;
  filteredStudents: Student[];
  visibleIds: number[];
  selectedStudentIds: number[];
  isLoading: boolean;
  onToggleCheck: (id: number, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  setSelectedStudentId: React.Dispatch<React.SetStateAction<number | null>>;
  handleDeleteChecked: () => Promise<void>;
  refetch: UseQueryResult<LectureMembersResponse, Error>["refetch"];
}

const StudentManageLeft: React.FC<StudentManageLeftProps> = ({
  searchQuery,
  setSearchQuery,
  viewSize,
  setViewSize,
  filteredStudents,
  visibleIds,
  selectedStudentIds,
  isLoading,
  onToggleCheck,
  setSelectedStudentId,
  handleDeleteChecked,
  refetch,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 페이지 네이션 상태 변수
  const [page, setPage] = useState(1);
  const totalItems = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / viewSize));

  // 검색어/페이지크기 변경 시 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [searchQuery, viewSize]);

  // 총 페이지 변화 시 현재 페이지가 범위를 벗어나면 보정
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleRefresh = () => {
    if (isRefreshing) return; // 중복 클릭 방지
    setIsRefreshing(true);
    try {
      refetch();
    } finally {
      // 살짝 딜레이를 주면 회전이 끊기지 않고 보여짐 (선택)
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  const startIndex = (page - 1) * viewSize;
  const endIndex = startIndex + viewSize;

  // 페이지에 따라 필터링 된 학생명단
  const pageStudents = useMemo(
    () => filteredStudents.slice(startIndex, endIndex),
    [filteredStudents, startIndex, endIndex]
  );
  // 현재 페이지에서의 전체 체크 여부
  const allCheckedOnPage =
    pageStudents.length > 0 &&
    pageStudents.every((s) => selectedStudentIds.includes(s.id));

  const handleToggleAllPage = (checked: boolean) => {
    // 부모의 onToggleAll(visibleIds 기반) 대신 현재 페이지의 항목만 개별 토글
    pageStudents.forEach((s) => onToggleCheck(s.id, checked));
  };
  const viewSizeOptions = [10, 25, 50, 100];

  const handleViewSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewSize(Number(e.target.value));
  };

  // 내부에서 사용할 StudentRow 컴포넌트
  const StudentRow: React.FC<{
    student: Student;
    index: number;
    checked: boolean;
    onCheck: (v: boolean) => void;
    onClick: () => void;
  }> = ({ student, index, checked, onCheck, onClick }) => (
    <div
      onClick={onClick}
      className={`group flex cursor-pointer items-center gap-2 border-b border-gray-300 px-3 py-2.5 hover:bg-indigo-50 ${
        checked ? "bg-indigo-100" : index % 2 === 1 ? "bg-slate-100" : "bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheck(e.target.checked)}
        onClick={(e) => {
          e.stopPropagation(); // Row 전체 onClick과 충돌 방지
        }}
        className="accent-primary-500"
      />
      <div className="flex items-center gap-[8px] overflow-hidden">
        <span className="font-kr text-[16px] font-medium text-black truncate">
          {student.name}
        </span>
        <span className="ml-[25px] font-kr text-[16px] font-medium text-gray-400 truncate">
          {student.studentId}
        </span>
      </div>
    </div>
  );

  return (
    <aside className="flex h-[620px] min-h-[620px] w-full flex-col lg:w-1/2 lg:pr-5 font-kr">
      {/* 검색 영역 */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="relative w-full">
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-indigo-500">
            {/* 인풋 */}
            <input
              type="text"
              placeholder="이름, 학번"
              className="flex-1 bg-transparent text-sm outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {/* 아이콘 */}
            <Image
              alt="Search icon"
              src={Search}
              width={20}
              height={20}
              className="pointer-events-none shrink-0"
            />
          </div>
        </div>

        <div className="relative w-[160px] self-end">
          <label htmlFor="viewSize" className="sr-only">
            한 페이지 표시 개수
          </label>
          <select
            id="viewSize"
            value={viewSize}
            onChange={handleViewSizeChange}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-700 hover:bg-gray-50 focus:border-indigo-500 focus:outline-none"
          >
            {viewSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}개씩 보기
              </option>
            ))}
          </select>

          {/* 우측 드롭다운 아이콘 */}
          <Image
            alt="Down icon"
            src={Down}
            width={14}
            height={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            priority
          />
        </div>
      </div>

      {/* 학생 목록 영역 */}
      <div className="mb-4 flex-1 min-h-0 overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm">
        <div className="h-full overflow-y-auto">
          {/* 목록 헤더 */}
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-300 bg-gray-100 px-3 py-2.5 font-kr text-sm font-semibold text-gray-600">
            <input
              type="checkbox"
              checked={allCheckedOnPage}
              onChange={(e) => handleToggleAllPage(e.target.checked)}
              className="accent-primary-500"
            />
            <span className="flex-1 whitespace-nowrap">이름</span>
            <span className="ml-5 flex items-center">
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded p-1 hover:bg-gray-200"
              >
                <Image
                  alt="새로고침"
                  src={Refresh}
                  width={18}
                  height={18}
                  className={`${
                    isRefreshing ? "animate-[spin_0.6s_linear_1]" : ""
                  }`}
                />
              </button>
            </span>
          </div>
          {isLoading ? (
            <div className="py-10 flex items-center justify-center text-gray-500">
              <LoadingSpinner className="text-indigo-600 mr-2" size={22} />
              불러오는 중...
            </div>
          ) : (
            <>
              {/* 학생 Row 반복 */}
              {pageStudents.slice(0, viewSize).map((student, idx) => (
                <StudentRow
                  key={`${student.id}-${student.studentId}`}
                  student={student}
                  index={idx}
                  checked={selectedStudentIds.includes(student.id)}
                  onCheck={(v) => onToggleCheck(student.id, v)}
                  onClick={() => setSelectedStudentId(student.id)}
                />
              ))}

              {/* 데이터가 없을 때 */}
              {filteredStudents.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-500">
                  검색 결과가 없습니다.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {/* 페이지네이션 바 */}
      <Pagination
        isStudentManage={true}
        deleteBttnClick={handleDeleteChecked}
        deleteBttndisabled={selectedStudentIds.length === 0}
        page={page}
        totalItems={filteredStudents.length}
        pageSize={viewSize}
        onPageChange={setPage}
      />
    </aside>
  );
};

export default StudentManageLeft;
