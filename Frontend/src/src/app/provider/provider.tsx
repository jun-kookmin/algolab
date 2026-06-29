// app/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import dynamic from "next/dynamic";

const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  // 렌더마다 새 인스턴스가 생성되지 않도록 useState로 고정
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  React.useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event: any) => {
      if (event?.type !== "updated") return;
      if (event?.action?.type !== "success") return;

      // 개별 mutation이 필요한 쿼리만 invalidate 하도록 두고,
      // 전역 훅은 즉시 refetch 대신 stale 표시만 수행해 refetch 폭주를 줄인다.
      if (event?.mutation?.options?.meta?.skipGlobalRefetch) return;

      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey?.[0] !== "me",
        refetchType: "none",
      });
    });

    return unsubscribe;
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== "production" ? (
        // Devtools는 개발 환경에서만 로드
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
