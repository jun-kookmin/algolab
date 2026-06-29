"use client";

import React, { useState } from "react";
import VerifyPassword from "@/app/mypage/components/VerifyPassword";
import MyInfo from "@/app/mypage/components/MyInfo";
import ChangePassword from "@/app/mypage/components/ChangePassword";
import { useMe } from "@/hooks/auth/get/useMe";

export const dynamic = "force-dynamic";

export default function MyPage() {
  const [step, setStep] = useState<"verify" | "info" | "changePwd">("info");

  // 임시 유저 데이터 (API에서 받아오는 값 대체)
  const { data: me } = useMe();

  // console.log(step, "개인정보 스텝");

  return (
    <div className="font-kr flex flex-col items-center justify-center h-[70vh] text-center">
      {step === "verify" && (
        <VerifyPassword onSuccess={() => setStep("info")} />
      )}
      {step === "info" && (
        <MyInfo me={me} onChangePwd={() => setStep("changePwd")} />
      )}
      {step === "changePwd" && (
        <ChangePassword onBack={() => setStep("info")} />
      )}
    </div>
  );
}
