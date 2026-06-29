// src/hooks/auth/useMe.ts
"use client";
import AuthApi from "@/utils/authApi";
import { useQuery } from "@tanstack/react-query";

export interface Me {
  pk: number;
  username: string;
  first_name: string;
  last_name: string;
  group: string;
}

export const useMe = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me> => {
      const { data } = await AuthApi.get<Me>("/auth/me", {
        silentSessionExpired: true,
      } as any);
      return data;
    },
    enabled: options?.enabled ?? false,
    retry: false,
    staleTime: 300_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
