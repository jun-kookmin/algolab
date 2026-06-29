import { Check } from "lucide-react";

export default function CopyToast({
  message = "복사됨",
}: {
  message?: string;
}) {
  return (
    <div
      className="fixed top-4 left-1/2 pointer-events-none
                 pt-[env(safe-area-inset-top)]"
      aria-live="polite"
      role="status"
    >
      <div
        className="flex items-center gap-2 rounded-full px-4 py-2 text-white
                   bg-violet-600/90 shadow-lg backdrop-blur-sm
                   animate-toast-pop"
      >
        <Check className="w-4 h-4" />
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  );
}
