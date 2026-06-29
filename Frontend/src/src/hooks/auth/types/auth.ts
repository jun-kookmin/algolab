// src/types/auth.ts
export interface LoginRequest {
  username: string; // ← 학번을 여기로 매핑
  password: string;
}

export interface LoginUser {
  pk: number;
  username: string;
  first_name: string;
  last_name: string;
}

export interface LoginResponse {
  access: string; // 바디에도 내려오는 구성
  refresh?: string; // 미노출이거나 빈 문자열일 수 있음
  user: LoginUser;
  replaced_existing_session?: boolean;
}

export interface RegisterRequest {
  username: string;
  password1: string;
  password2: string;
  first_name: string;
  last_name: string;
}

export type RegisterResponse = LoginResponse;
