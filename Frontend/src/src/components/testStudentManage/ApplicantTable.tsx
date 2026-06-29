"use client";

import { useState } from "react";

interface Student {
  id: number;
  name: string;
  studentId: string;
  submitted: boolean;
  submittedAt?: string;
  score?: number;
}

const dummyStudents: Student[] = [
  {
    id: 1,
    name: "Student A",
    studentId: "STUDENT001",
    submitted: true,
    submittedAt: "25.07.11 13:05",
    score: 95,
  },
  {
    id: 2,
    name: "Student B",
    studentId: "STUDENT002",
    submitted: false,
  },
  {
    id: 3,
    name: "Student C",
    studentId: "STUDENT003",
    submitted: true,
    submittedAt: "25.07.11 11:25",
    score: 82,
  },
];

export default function ApplicantTable() {
  const [students] = useState<Student[]>(dummyStudents);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">응시 학생 관리</h2>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left border">이름</th>
              <th className="px-4 py-2 text-left border">학번</th>
              <th className="px-4 py-2 text-center border">응시 여부</th>
              <th className="px-4 py-2 text-center border">제출 시간</th>
              <th className="px-4 py-2 text-center border">점수</th>
            </tr>
          </thead>
          <tbody>
            {students.map((stu) => (
              <tr key={stu.id} className="border-b">
                <td className="px-4 py-2 border">{stu.name}</td>
                <td className="px-4 py-2 border">{stu.studentId}</td>
                <td className="px-4 py-2 text-center border">
                  {stu.submitted ? "✅ 응시함" : "❌ 미응시"}
                </td>
                <td className="px-4 py-2 text-center border">
                  {stu.submittedAt ?? "-"}
                </td>
                <td className="px-4 py-2 text-center border">
                  {stu.score !== undefined ? `${stu.score}점` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
