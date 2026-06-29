// ──── FILE: components/StudentManageRight.tsx ────
"use client";

import React from "react";
import { Student } from "@/types/student";

interface StudentManageRightProps {
  student: Student | null;
  userId: number;
  lectureId: string;
}

const StudentManageRight: React.FC<StudentManageRightProps> = ({
  student,
  userId,
  lectureId,
}) => {
  // 내부에서만 사용할 InfoRow 컴포넌트
  const InfoRow: React.FC<{ label: string; value: string }> = ({
    label,
    value,
  }) => (
    <div>
      <p className="font-kr text-[14px] font-semibold text-gray-500">{label}</p>
      <p className="font-kr text-[16px] font-semibold text-gray-900">{value}</p>
    </div>
  );

  // console.log(student, "학생정보");

  return (
    <section className="w-full min-h-[620px] lg:w-1/2">
      <h3 className="mb-2 font-kr text-[18px] font-semibold text-black">
        기본 정보
      </h3>
      <div className="mb-6 h-px bg-gray-400" />

      {student ? (
        <div className="space-y-6">
          <InfoRow label="이름" value={student.name} />
          <InfoRow label="학번" value={student.studentId} />
        </div>
      ) : (
        <p className="text-sm text-gray-500">선택된 학생이 없습니다.</p>
      )}

      <div className="mt-8 mb-3 h-px bg-gray-400" />
    </section>
  );
};

export default StudentManageRight;
