"use client";

import React, { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

export interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (rows: { name: string; studentId: string }[]) => void;
}

/** 학번/사번/교번 형태: 숫자 6자리 이상 또는 영문/숫자/기호 문자열(4~32자) 허용 */
const looksLikeStudentId = (v?: string) =>
  !!v && (/^\d{6,}$/.test(v) || /^[A-Za-z0-9._-]{4,32}$/.test(v));

/** 헤더 후보: 한/영 혼용 지원 */
const headerKeys = {
  name: ["이름", "name", "Name"],
  studentId: [
    "학번",
    "studentId",
    "StudentId",
    "student_id",
    "username",
    "user_name",
    "user id",
    "userid",
    "학　번",
  ],
};

const detectHeaderIndexes = (row: string[]) => {
  const lower = row.map((x) => x?.toString().trim().toLowerCase() ?? "");
  const findIdx = (cands: string[]) =>
    lower.findIndex((v) =>
      cands.some((c) => v === c.toLowerCase() || v.includes(c.toLowerCase()))
    );

  const nameIdx = findIdx(headerKeys.name);
  const idIdx = findIdx(headerKeys.studentId);
  return {
    nameIdx,
    idIdx,
    looksHeader: nameIdx >= 0 || idIdx >= 0,
  };
};

// ...상단 import 동일

// === 그대로 유지: looksLikeStudentId, headerKeys, detectHeaderIndexes ===

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  open,
  onClose,
  onUpload,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // CSV 전용 파서
  const parseAndUpload = async (_file: File) => {
    try {
      // 확장자 최종 방어
      if (!/\.csv$/i.test(_file.name)) {
        alert("CSV 파일만 업로드 가능합니다.");
        return;
      }

      const text = await readCsvTextWithFallback(_file); // UTF-8 → EUC-KR
      const workbook = XLSX.read(text, { type: "string" }); // CSV도 시트처럼 읽기
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
        raw: false,
      }) as any[][];

      const nonEmpty = aoa.filter((r) => {
        const a = (r[0] ?? "").toString().trim();
        const b = (r[1] ?? "").toString().trim();
        return a || b;
      });

      if (nonEmpty.length === 0) {
        alert("비어있는 파일입니다.");
        return;
      }

      const first = (nonEmpty[0] ?? []).map((x) => String(x).trim());
      const { nameIdx, idIdx, looksHeader } = detectHeaderIndexes(first);
      const dataRows = looksHeader ? nonEmpty.slice(1) : nonEmpty;

      const nIdx = nameIdx >= 0 ? nameIdx : 0;
      const sIdx = idIdx >= 0 ? idIdx : 1;

      const rows = dataRows
        .map((arr) => {
          const name = String(arr[nIdx] ?? "").trim();
          const studentId = String(arr[sIdx] ?? "").trim();
          return { name, studentId };
        })
        .filter((r) => looksLikeStudentId(r.studentId));

      onUpload(rows);
      onClose();
    } catch {
      // console.error(e);
      alert("CSV를 읽는 중 오류가 발생했습니다. 형식을 확인해주세요.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    await parseAndUpload(file);
  };

  // === DnD 핸들러 동일 ===
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragActive(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) setDragActive(false);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);

    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    // CSV만 허용
    if (!/\.csv$/i.test(f.name)) {
      alert("CSV 파일만 업로드 가능합니다.");
      return;
    }
    setFile(f);
    // 원하면 즉시 파싱:
    // parseAndUpload(f);
  }, []);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div className="relative z-10 flex min-h-full items-start justify-center py-4 sm:items-center">
        <div
          className="fluid-modal-sm relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white px-[clamp(16px,2vw,40px)] py-[clamp(16px,2vh,32px)] shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <h3 className="font-kr fluid-title-lg mb-4 text-center font-semibold text-primary-black">
            학생 일괄 업로드
          </h3>

        {/*안내 문구 수정: CSV만 */}
        <p className="mb-1 text-center font-kr text-[clamp(12px,0.8vw,14px)] text-[#6D717F]">
          CSV의 <strong>이름/학번/사용자명</strong> 헤더를 자동 인식합니다.
        </p>
        <p className="mb-3 text-center font-kr text-[clamp(11px,0.72vw,12px)] text-[#9AA0A6]">
          드래그&드롭 또는 클릭하여 <strong>CSV 파일</strong>을 선택하세요
        </p>

        <div className="mt-5 flex flex-col items-center gap-2">
          <label
            htmlFor="bulkFile"
            className={[
              "flex h-[clamp(90px,10vh,112px)] w-[clamp(220px,16vw,240px)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-gray-500 transition",
              dragActive
                ? "border-[#4E61F6]/80 bg-indigo-50"
                : "border-gray-300 hover:bg-gray-50",
            ].join(" ")}
            onClick={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            aria-label="파일 드롭존"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <span className="text-sm">
              {file ? file.name : "여기로 드래그하거나 클릭하여 선택"}
            </span>
            <span className="text-[clamp(10px,0.68vw,11px)] text-gray-400">(.csv)</span>
          </label>

          {/* accept과 검증을 CSV로 고정 */}
          <input
            id="bulkFile"
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && !/\.csv$/i.test(f.name)) {
                alert("CSV 파일만 업로드 가능합니다.");
                e.currentTarget.value = "";
                return;
              }
              setFile(f);
            }}
          />
        </div>

          <div className="mt-8 flex justify-center gap-4">
            <button
              type="button"
              onClick={handleUpload}
              className="fluid-control-h fluid-btn-w-md rounded-xl bg-[#4E61F6] px-[clamp(10px,0.9vw,14px)] text-[clamp(12px,0.84vw,16px)] font-semibold text-white hover:bg-[#6676F8] active:scale-95 disabled:opacity-40"
              disabled={!file}
            >
              업로드
            </button>
            <button
              type="button"
              onClick={onClose}
              className="fluid-control-h fluid-btn-w-md rounded-xl border border-[#4E61F6] px-[clamp(10px,0.9vw,14px)] text-[clamp(12px,0.84vw,16px)] font-semibold text-[#4E61F6] hover:bg-indigo-50 active:scale-95"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== 유틸: CSV 인코딩 자동 처리 =====
async function readCsvTextWithFallback(file: File): Promise<string> {
  const utf8 = await file.text(); // 기본 UTF-8 시도
  if (!looksBroken(utf8)) return utf8;
  // EUC-KR 재시도
  return await readAsTextWithEncoding(file, "euc-kr");
}
function looksBroken(s: string) {
  const bad = (s.match(/\uFFFD/g) || []).length;
  return bad > 2;
}
function readAsTextWithEncoding(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.onerror = reject;
    fr.readAsText(file, encoding);
  });
}

export default BulkUploadModal;
