// src/hooks/auth/useLogin.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LoginRequest, LoginResponse } from "@/hooks/auth/types/auth";
import AuthApi from "@/utils/authApi";
import {
  clearDuplicateLoginAlertFlag,
  markDuplicateLoginAlertShown,
  shouldShowDuplicateLoginAlert,
  DUPLICATE_LOGIN_ALERT_MESSAGE,
} from "@/utils/duplicateLoginAlert";

const login = async (payload: LoginRequest): Promise<LoginResponse> => {
  try {
    clearDuplicateLoginAlertFlag();
    const { data } = await AuthApi.post<LoginResponse>("/auth/login/", payload);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("algolab_session_expired_alerted");
    }
    // 쿠키는 httpOnly로 자동 저장(백엔드 설정), body의 access는 참고용
    return data;
  } catch (e: any) {
    // DRF 표준 에러 메시지 추출
    const msg =
      e?.response?.data?.detail ??
      e?.response?.data?.non_field_errors?.[0] ??
      "로그인에 실패했습니다. 아이디/비밀번호를 확인하세요.";
    throw new Error(msg);
  }
};

export const useLogin = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginRequest) => login(payload),
    onSuccess: (data) => {
      if (typeof window !== "undefined" && shouldShowDuplicateLoginAlert(data?.replaced_existing_session)) {
        markDuplicateLoginAlertShown();
        window.alert(DUPLICATE_LOGIN_ALERT_MESSAGE);
      }
      // 1) 세션/쿠키 기반이므로 토큰 저장 불필요
      // 2) me 쿼리를 쓰고 있다면 invalidate 또는 setQueryData
      //    - invalidate: 서버에서 fresh 상태를 다시 받아오기
      qc.invalidateQueries({ queryKey: ["me"] });

      // 또는 즉시 반영 원하면:
      // qc.setQueryData(["me"], data.user);
    },
  });
};
