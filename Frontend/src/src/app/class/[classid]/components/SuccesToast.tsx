import StarIcon from "@/app/assets/classmanage/star.svg";

export default function SuccessToast({
  open,
  title,
  desc,
  onClose,
}: {
  open: boolean;
  title: string;
  desc?: string;
  onClose?: () => void;
}) {
  return (
    <div
      aria-live="polite"
      className={`fixed top-6 right-6 z-[100] transition-all duration-300 ${
        open
          ? "opacity-100 translate-y-0"
          : "opacity-0 pointer-events-none -translate-y-2"
      }`}
    >
      <div className="fluid-modal-sm flex items-start justify-center gap-3 rounded-2xl bg-[#4E61F6] px-[clamp(12px,1.2vw,16px)] py-[clamp(10px,1vh,14px)] text-white shadow-lg">
        <StarIcon />
        <div className="flex-1">
          <p className="text-[clamp(13px,0.9vw,15px)] font-semibold leading-5">{title}</p>
          {desc ? <p className="mt-1 text-[clamp(12px,0.78vw,13px)] opacity-90">{desc}</p> : null}
        </div>
        {/* <button
          onClick={onClose}
          className="ml-2 rounded-md/none opacity-70 hover:opacity-100 focus:outline-none"
          aria-label="닫기"
        >
          ✕
        </button> */}
      </div>
    </div>
  );
}
