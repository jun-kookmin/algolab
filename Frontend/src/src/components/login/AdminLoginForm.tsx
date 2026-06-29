"use client";

import React, { useEffect, useState, FormEvent } from "react";
import Image from "next/image";
import {
  getStoredAdminUsername,
  setStoredAdminUsername,
  clearStoredAdminUsername,
} from "@/utils/adminRemember";

const ICON_EYE = "/assets/icon/Icon_Eye.svg";

interface Props {
  isActive: boolean;
  onLogin: (username: string, password: string, remember: boolean) => Promise<void>;
  onBack: () => void;
  isPending: boolean;
  error: any;
  resetError: () => void;
}

const AdminLoginForm: React.FC<Props> = ({
  isActive,
  onLogin,
  onBack,
  isPending,
  error,
  resetError,
}) => {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedUsername = getStoredAdminUsername();
    if (savedUsername) {
      setStudentId(savedUsername);
      setRemember(true);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      const trimmedStudentId = studentId.trim();
      if (remember && trimmedStudentId) {
        setStoredAdminUsername(trimmedStudentId);
      } else {
        clearStoredAdminUsername();
      }

      await onLogin(trimmedStudentId, password, remember);
    } catch {
      setLocalError("로그인에 실패했습니다");
    }
  };

  const handleRememberChange = (nextChecked: boolean) => {
    setRemember(nextChecked);
    const trimmedStudentId = studentId.trim();
    if (nextChecked && trimmedStudentId) {
      setStoredAdminUsername(trimmedStudentId);
      return;
    }
    clearStoredAdminUsername();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={` h-[272px] overflow-y-auto absolute inset-0 flex flex-col transition-opacity duration-600
    ${
      isActive
        ? "opacity-100 pointer-events-auto"
        : "opacity-0 pointer-events-none "
    }`}
    >
      {(localError || error) && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {localError || (error as Error).message}
        </div>
      )}
      {/* 아이디, 비번 입력 컨테이저
      (oauth <-> admin 전환시ui흔들림 방지를 위해 LoginForm높이 동일하게-[flex-1으로 설정]*/}
      <div className="flex-col flex-1">
        <div className="mb-4">
          <input
            type="text"
            value={studentId}
            onChange={(e) => {
              const nextValue = e.target.value;
              setStudentId(nextValue);
              if (remember) {
                const trimmedValue = nextValue.trim();
                if (trimmedValue) {
                  setStoredAdminUsername(trimmedValue);
                } else {
                  clearStoredAdminUsername();
                }
              }
            }}
            placeholder="아이디"
            className="font-kr text-sm w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>

        <div className="mb-4">
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="font-kr text-sm w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50"
            />

            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute inset-y-0 right-3 flex items-center"
            >
              <Image src={ICON_EYE} alt="pwd" width={20} height={20} />
            </button>
          </div>
        </div>

        <div className="">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => handleRememberChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <span className="font-kr ml-2 text-sm">아이디 기억하기</span>
          </label>
        </div>
      </div>
      {/* 버튼 컨테이너 */}
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-[#7181f8] text-white rounded-md transition cursor-pointer"
        >
          {isPending ? "로그인 중..." : "관리자 Log In"}
        </button>

        <button
          type="button"
          onClick={() => {
            onBack();
            setLocalError("");
            resetError();
          }}
          className="font-eng font-semibold py-3 text-[#7181f8] border-1 border-[#7181f8] rounded-md cursor-pointer"
        >
          ← OAuth 로그인으로 돌아가기
        </button>
      </div>
    </form>
  );
};

export default AdminLoginForm;
