'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import DeleteModal from '@/components/class/DeleteModal';
import type { Problem } from '@/types/problem';
import ProblemPreviewModal from '@/components/class/ProblemImportModal/ProblemPreviewModal';
import { useDeleteProblem } from '@/hooks/problems/delete/useDeleteProblem';

interface Props {
  problems: Problem[];
  /** (선택) 부모에서 라우팅을 제어하고 싶을 때 사용 */
  onEdit?: (id: string) => void;
}

const difficultyBadgeClass = (difficulty: Problem["difficulty"]) => {
  switch (difficulty) {
    case "EASY":
      return "border-green-200 bg-green-50 text-green-700";
    case "MEDIUM":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "HARD":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-500";
  }
};

const ProblemListRenderer: React.FC<Props> = ({ problems, onEdit }) => {
  const router = useRouter();

  const [items, setItems] = useState<Problem[]>(problems);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { mutateAsync: deleteProblem, isPending: isDeleting } = useDeleteProblem();

  // ✅ 부모 props 변경 시 내부 상태 동기화
  useEffect(() => {
    setItems(problems);
  }, [problems]);

  const openModal = (id: string) => {
    setTargetId(id);
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (targetId == null || isDeleting) return;
    try {
      await deleteProblem(targetId);
      setItems((prev) => prev.filter((p) => p.id !== targetId));
      setModalOpen(false);
      setTargetId(null);
    } catch {
      alert("문제 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setTargetId(null);
  };

  const handleEditClick = (id: string) => {
    if (onEdit) {
      onEdit(id);
    } else {
      router.push(`/problem/${id}/edit`);
    }
  };

  const openPreview = (id: string) => {
    setPreviewId(id);
  };

  const closePreview = () => {
    setPreviewId(null);
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            표시할 문제가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse text-sm text-gray-700">
              {/* 열 너비: 제목 auto / 난이도 6rem / 출제자 9rem / 수정 5rem / 삭제 3rem */}
              <colgroup>
                <col />
                <col style={{ width: "6rem" }} />
                <col style={{ width: "9rem" }} />
                <col style={{ width: "5rem" }} />
                <col style={{ width: "3rem" }} />
              </colgroup>

              <thead>
                <tr className="border-b border-gray-300 bg-gray-100 text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                  <th className="px-3 py-2.5 text-center">문제</th>
                  <th className="border-l border-gray-300 px-3 py-2.5 text-center">
                    난이도
                  </th>
                  <th className="border-l border-gray-300 px-3 py-2.5 text-center">
                    출제자
                  </th>
                  <th className="border-l border-gray-300 px-3 py-2.5 text-center">
                    수정
                  </th>
                  <th className="border-l border-gray-300 px-3 py-2.5 text-center">
                    삭제
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`group border-b border-gray-300 transition-colors ${
                      idx % 2 === 1 ? "bg-slate-100" : "bg-white"
                    } cursor-pointer hover:bg-indigo-50`}
                    onClick={() => openPreview(p.id)}
                  >
                    {/* ✅ 제목: 가운데 정렬 */}
                    <td className="px-3 py-2.5 text-center align-middle">
                      <div className="mx-auto max-w-full truncate font-kr text-gray-900" title={p.title}>
                        {p.title}
                      </div>
                    </td>

                    <td className="border-l border-gray-300 px-3 py-2.5 text-center align-middle">
                      <span className={`rounded-[2px] border px-2 py-1 text-xs ${difficultyBadgeClass(p.difficulty)}`}>
                        {p.difficulty || "-"}
                      </span>
                    </td>

                    <td className="border-l border-gray-300 px-3 py-2.5 text-center align-middle">
                      <div
                        className="mx-auto max-w-full truncate font-kr text-gray-700"
                        title={p.makerName || "-"}
                      >
                        {p.makerName || "-"}
                      </div>
                    </td>

                    {/* 수정 버튼 */}
                    <td className="border-l border-gray-300 px-3 py-2.5 text-center align-middle">
                      {p.canEdit !== false ? (
                        <button
                          className="font-kr inline-flex items-center justify-center rounded-[10px] border border-green-500 bg-white px-3 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(p.id);
                          }}
                          title="수정"
                        >
                          수정
                        </button>
                      ) : (
                        <span className="font-kr text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* 삭제 아이콘 */}
                    <td className="border-l border-gray-300 px-1 py-2.5 text-center align-middle">
                      {p.canEdit !== false ? (
                        <div
                          className="relative mx-auto h-4 w-4 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(p.id);
                          }}
                          title="삭제"
                        >
                          <Image
                            src="/assets/icon/Icon_TrashCan(Black).svg"
                            alt="휴지통"
                            className="absolute inset-0 h-4 w-4 opacity-60 transition-opacity group-hover:opacity-0"
                            width={16}
                            height={16}
                          />
                          <Image
                            src="/assets/icon/Icon_TrashCan(Red).svg"
                            alt="휴지통-빨강"
                            className="absolute inset-0 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                            width={16}
                            height={16}
                          />
                        </div>
                      ) : (
                        <span className="font-kr text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteModal
        open={modalOpen}
        onConfirm={handleConfirmDelete}
        onClose={handleCloseModal}
      />

      {previewId && (
        <ProblemPreviewModal questionId={previewId} onClose={closePreview} />
      )}
    </>
  );
};

export default ProblemListRenderer;
