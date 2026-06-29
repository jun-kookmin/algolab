import RedStar from "@/app/assets/classmanage/RedStar.svg";
export default function ConfirmDeleteModal({
  open,
  count,
  onCancel,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] overflow-y-auto p-4 font-kr"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 flex min-h-full items-start justify-center py-4 sm:items-center">
        {/* card */}
        <div className="fluid-modal-sm relative flex max-h-[calc(100dvh-2rem)] flex-col items-center overflow-y-auto rounded-2xl bg-white px-[clamp(16px,1.4vw,24px)] py-[clamp(16px,1.6vh,24px)] text-center shadow-xl">
          <RedStar />
          <p className="mt-[clamp(12px,2vh,21px)] text-[clamp(14px,0.95vw,16px)] font-bold text-[#111]">
            정말 삭제하시겠습니까?
          </p>
          <p className="mt-2 text-[clamp(12px,0.78vw,13px)] leading-5 text-[#8A8F9C]">
            {/* 선택된 <b className="text-[#111]">{count}</b>명 학생이 삭제됩니다.
            <br /> */}
            한번 삭제하면 복구할 수 없습니다. 신중하게 생각하고 삭제하세요.
          </p>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[#FF5E5E] bg-white text-sm font-semibold text-[#FF5E5E] hover:bg-[#FFF2F2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "삭제 중..." : "삭제하기"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[#4E61F6] bg-white text-sm font-semibold text-[#4E61F6] hover:bg-[#EEF1FF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
