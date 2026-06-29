"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import OAuthLoginForm from "@/components/login/OAuthLoginForm";
import { getOAuthApiBase } from "@/utils/apiBase";
import { clearExamLock } from "@/utils/examLock";

const LoginForm: React.FC = () => {
  const searchParams = useSearchParams();
  const oauthError = searchParams?.get("oauth_error");
  const oauthErrorDetail = searchParams?.get("oauth_error_detail");

  useEffect(() => {
    clearExamLock();
  }, []);

  const oauthErrorMessage =
    oauthError === "missing_code"
      ? "OAuth 인증 코드가 없어 로그인을 완료하지 못했습니다. 다시 시도해 주세요."
      : oauthError === "oauth_login_failed" &&
          oauthErrorDetail === "token_exchange_failed"
        ? "OAuth access token 교환에 실패했습니다. 콜백 URL 또는 앱 설정을 확인한 뒤 다시 시도해 주세요."
        : oauthError === "oauth_login_failed"
          ? "OAuth 로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
          : null;

  const handleOAuth = () => {
    clearExamLock();
    const baseUrl = getOAuthApiBase();
    window.location.href = `${baseUrl}/accounts/oauth/authorize/`;
  };

  return (
    <div className="flex items-center justify-center h-full">
      {/* 로그인 카드 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-3xl w-full min-h-[320px] z-10">
        <div className="flex flex-row items-center gap-8">
          {/* 왼쪽 로고 */}
          <div className="flex-shrink-0">
            <Image
              src="/AlgolabMainLogo.svg"
              alt="Algolab Main Logo"
              width={250}
              height={200}
              priority
            />
          </div>

        {/* 오른쪽 UI */}
          <div className="flex-1 min-h-[272px]">
            {oauthErrorMessage ? (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {oauthErrorMessage}
              </div>
            ) : null}
            <OAuthLoginForm
              isActive={true}
              onClickOAuth={handleOAuth}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
