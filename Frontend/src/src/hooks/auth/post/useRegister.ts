// src/hooks/auth/useRegister.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  RegisterRequest,
  RegisterResponse,
} from "@/hooks/auth/types/auth";
import AuthApi from "@/utils/authApi";

const register = async (
  payload: RegisterRequest
): Promise<RegisterResponse> => {
  try {
    const { data } = await AuthApi.post<RegisterResponse>(
      "/auth/registration/",
      payload
    );
    // 회원가입 성공 시 서버가 access/refresh 쿠키를 내려줌
    return data;
  } catch (e: any) {
    const data = e?.response?.data ?? {};
    const msg =
      e?.response?.data?.detail ??
      e?.response?.data?.non_field_errors?.[0] ??
      (Array.isArray(Object.values(data)[0])
        ? (Object.values(data)[0] as string[])[0]
        : "회원가입에 실패했습니다. 입력 정보를 확인하세요.");
    throw new Error(msg);
  }
};

export const useRegister = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterRequest) => register(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
};
