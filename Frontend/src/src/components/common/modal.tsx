"use client";
import React from "react";
import { createPortal } from "react-dom";

export default function Modal({
  children,
  onClose,
  title = "상세 보기",
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1200] overflow-y-auto p-4 font-kr">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex min-h-full items-center justify-center">
        <div className="relative flex w-full max-w-4xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3">
            <h2 className="font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded px-2 py-1 text-sm hover:bg-gray-100"
            >
              닫기
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
