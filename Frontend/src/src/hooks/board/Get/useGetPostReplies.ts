// src/hooks/board/Get/useGetPostReplies.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export interface PostReply {
  id: string;
  reply_content: string;
  user_name: string;
  user_id?: number;
  parent_uuid?: string | null;
  reply_date: string;
  can_edit: boolean;
  can_open_submission?: boolean;
}

const normalizeReplies = (items: any[]): PostReply[] =>
  items.map((r: any) => ({
    ...r,
    id: String(r.uuid ?? r.id ?? ""),
    user_id:
      typeof r?.user_id === "number"
        ? r.user_id
        : undefined,
    parent_uuid: r?.parent_uuid ?? null,
    can_open_submission: Boolean(r?.can_open_submission),
  }));

const extractItems = (payload: any): any[] =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
    ? payload.results
    : [];

const fetchPostReplies = async (postUuid: string): Promise<PostReply[]> => {
  const endpoint = `/instructor/posts/${postUuid}/replies/`;
  const { data: firstData } = await BaseApi.get<unknown>(endpoint, {
    params: { page: 1, size: 100 },
  });

  const firstPayload = firstData as any;
  if (Array.isArray(firstPayload)) {
    return normalizeReplies(firstPayload);
  }

  let merged = extractItems(firstPayload);
  let nextUrl: string | null =
    typeof firstPayload?.next === "string" ? firstPayload.next : null;
  let guard = 0;

  while (nextUrl && guard < 50) {
    guard += 1;
    const { data: nextData } = await BaseApi.get<unknown>(nextUrl);
    const nextPayload = nextData as any;
    merged = merged.concat(extractItems(nextPayload));
    nextUrl = typeof nextPayload?.next === "string" ? nextPayload.next : null;
  }

  return normalizeReplies(merged);
};

type PostRepliesQueryOptions = Omit<
  UseQueryOptions<PostReply[], Error, PostReply[]>,
  "queryKey" | "queryFn"
>;

export const useGetPostReplies = (
  postUuid: string | undefined,
  options?: PostRepliesQueryOptions
) => {
  return useQuery({
    queryKey: ["postReplies", postUuid],
    queryFn: () => {
      if (!postUuid) {
        return Promise.reject(new Error("post id is undefined"));
      }
      return fetchPostReplies(postUuid);
    },
    enabled: (options?.enabled ?? true) && !!postUuid,
    ...options,
  });
};
