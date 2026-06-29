"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export interface LanguageOption {
  id: number;
  language_name: string;
}

const fetchLanguages = async (): Promise<LanguageOption[]> => {
  const { data } = await BaseApi.get<unknown>("/instructor/languages/");
  const payload = data as any;
  if (Array.isArray(payload)) return payload as LanguageOption[];
  if (Array.isArray(payload?.data)) return payload.data as LanguageOption[];
  if (Array.isArray(payload?.results)) return payload.results as LanguageOption[];
  return [];
};

export const useGetLanguages = (
  options?: Omit<
    UseQueryOptions<LanguageOption[], Error, LanguageOption[]>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery({
    queryKey: ["languages"],
    queryFn: fetchLanguages,
    staleTime: 60_000,
    ...options,
  });
};
