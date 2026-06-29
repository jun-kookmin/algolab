// ──── FILE: src/components/RegistrationForm.tsx ────
"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRegister } from "@/hooks/auth/post/useRegister";
import { useRouter } from "next/navigation";

const ICON_EYE = "/assets/icon/Icon_Eye.svg";

const RegistrationForm: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { mutateAsync: register } = useRegister();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 기본 유효성 검사
    if (!lastName.trim()) {
      setError("성을 입력하세요.");
      return;
    }
    if (!firstName.trim()) {
      setError("이름을 입력하세요.");
      return;
    }
    if (!studentId.trim()) {
      setError("학번을 입력하세요.");
      return;
    }
    if (!password.trim() || !confirmPassword.trim()) {
      setError("비밀번호와 비밀번호 확인란을 입력하세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!agree) {
      setError("개인 정보 수집에 동의해야 합니다.");
      return;
    }

    try {
      await register({
        username: studentId,
        password1: password,
        password2: confirmPassword,
        first_name: firstName,
        last_name: lastName,
      });

      alert("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "회원가입 중 오류가 발생했습니다.");
    }
  };
  // console.log(error);

  return (
    <div className="flex items-center justify-center h-full ">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col bg-white rounded-2xl shadow-lg pt-8 px-8 max-w-md w-full h-[90%] my-4 z-10"
      >
        {/* 헤더 */}
        <h2 className="font-kr text-2xl font-bold text-center mb-6">
          회원가입
        </h2>

        <div className="px-2 space-y-4 w-full h-3/5 overflow-y-auto">
          {/* 이름 (성, 이름) */}
          <div className="flex space-x-2 ">
            <div className="flex-1 font-kr">
              <label className="font-kr block text-sm font-medium mb-1">
                성 (Last Name)
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="성을 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50
      focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="font-kr block text-sm font-medium mb-1">
                이름 (First Name)
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50
      focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 아이디 */}
          <div className="font-kr">
            <label className="block text-sm font-medium mb-1">아이디</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="아이디를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 비밀번호 설정 */}
          <div>
            <label className="font-kr block text-sm font-medium mb-1">
              비밀번호 설정
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute inset-y-0 right-3 flex items-center"
              >
                <Image
                  src={ICON_EYE}
                  alt="Show/Hide password"
                  width={20}
                  height={20}
                />
              </button>
            </div>
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="font-kr block text-sm font-medium mb-1">
              비밀번호 확인
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 확인"
                className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-3 flex items-center"
              >
                <Image
                  src={ICON_EYE}
                  alt="Show/Hide confirm password"
                  width={20}
                  height={20}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 개인정보 동의 */}
        <div className="mt-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={agree}
              onChange={() => setAgree(!agree)}
              className="font-kr h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="font-kr ml-2 text-sm">
              개인 정보 수집에 동의합니다.
            </span>
          </label>
        </div>
        <div className="flex flex-col">
          {/* 회원가입 버튼 */}
          <button
            type="submit"
            disabled={!agree}
            className="font-kr mt-6 w-full py-3 bg-blue-600 text-white rounded-md
                     disabled:opacity-50 hover:bg-blue-700 transition"
          >
            계정 생성하기
          </button>
          {error && (
            <p className="font-kr pt-2 text-sm text-red-600 text-center">
              {error}
            </p>
          )}

          {/* 구분선 + 로그인 링크 */}
          <hr className="my-4 border-gray-200" />
          <div className="flex justify-center items-center text-center">
            <Link
              href="/login"
              className="font-kr text-sm text-blue-600 hover:underline mb-4"
            >
              기존계정으로 로그인하기
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
