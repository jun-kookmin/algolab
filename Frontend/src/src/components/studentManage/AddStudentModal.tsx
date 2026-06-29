"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AddStudentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: string[]) => Promise<void> | void; // 배열 전달
  submitting?: boolean;
};

const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  submitting,
}) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = submitting ?? internalLoading;

  useEffect(() => {
    if (!isOpen) {
      setValue("");
      setError(null);
      setInternalLoading(false);
    } else {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value]);

  if (!isOpen) return null;

  const splitToIds = (raw: string) =>
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const validateMany = (ids: string[]) => {
    if (ids.length === 0) return "값을 입력해 주세요.";
    const invalid = ids.filter(
      (s) => !/^\d{6,}$/.test(s) && !/^[A-Za-z0-9._-]{4,32}$/.test(s)
    );
    if (invalid.length) {
      return `형식 오류: ${invalid.slice(0, 3).join(", ")}${
        invalid.length > 3 ? " 등" : ""
      }`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const ids = splitToIds(value);
    const err = validateMany(ids);
    if (err) {
      setError(err);
      return;
    }
    try {
      setError(null);
      if (submitting === undefined) setInternalLoading(true);
      await onSubmit(ids); //
      if (submitting === undefined) setInternalLoading(false);
      onClose();
    } catch {
      if (submitting === undefined) setInternalLoading(false);
      setError("초대에 실패했습니다. 학번 또는 사용자명이 맞는지 확인해주세요.");
    }
  };

  const modal = (
    <div
      aria-modal="true"
      role="dialog"
      aria-labelledby="add-student-title"
      className="fixed inset-0 z-[1000] overflow-y-auto p-4"
    >
      {/* Dimmed */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex min-h-full items-start justify-center py-4 sm:items-center">
        {/* Card */}
        <div className="fluid-modal-md relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-black/[0.06] bg-white p-[clamp(16px,1.6vw,24px)] shadow-xl">
          <h2
            id="add-student-title"
            className="w-full text-center text-[clamp(18px,1.4vw,22px)] font-semibold tracking-[-0.2px] text-black"
          >
            학생 추가
          </h2>
          <p className="mt-1 w-full text-center text-[clamp(12px,0.8vw,13px)] text-black/60">
            학번 또는 사용자명을 입력해 주세요.{" "}
            <span className="text-black/40">(쉼표/공백/엔터로 여러 명 가능)</span>
          </p>

          <div className="mt-5">
            <label className="sr-only" htmlFor="student-id">
              학번/사번/교번/사용자명
            </label>
            <input
              id="student-id"
              ref={inputRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="예) STUDENT001, admin, STUDENT002  (또는 줄바꿈으로 붙여넣기)"
              className="fluid-control-h w-full rounded-xl border border-[#E5E7EB] px-4 text-[clamp(12px,0.8vw,14px)] outline-none placeholder:text-black/35 focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15"
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="fluid-control-h flex-1 rounded-xl bg-[#6366F1] text-[clamp(12px,0.8vw,14px)] font-semibold text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "초대 중..." : "초대하기"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="fluid-control-h flex-1 rounded-xl border border-black/15 text-[clamp(12px,0.8vw,14px)] font-semibold text-black hover:bg-black/[0.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
};

export default AddStudentModal;
