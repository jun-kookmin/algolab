"use client";

import { useEffect, useRef } from "react";
import AuthApi from "@/utils/authApi";

const SESSION_EXTEND_INTERVAL_MS = 55 * 60 * 1000;

const postSessionPing = async (): Promise<void> => {
  await AuthApi.request({
    url: "/auth/session/ping/",
    method: "post",
    data: {},
    silentSessionExpired: true,
    timeout: 10000,
  } as any);
};

export const useSessionPresence = ({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId: number | null;
}) => {
  const timeoutIdRef = useRef<number | null>(null);
  const pingInFlightRef = useRef<Promise<void> | null>(null);
  const lastExtendedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled || !userId || typeof window === "undefined") {
      return;
    }

    let disposed = false;

    const clearScheduled = () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };

    const scheduleNext = () => {
      clearScheduled();
      timeoutIdRef.current = window.setTimeout(() => {
        extendSession();
      }, SESSION_EXTEND_INTERVAL_MS);
    };

    const extendSession = () => {
      if (disposed) return;
      if (pingInFlightRef.current) return;
      const nextPing = postSessionPing()
        .then(() => {
          lastExtendedAtRef.current = Date.now();
        })
        .catch(() => {})
        .finally(() => {
          if (pingInFlightRef.current === nextPing) {
            pingInFlightRef.current = null;
          }
          if (!disposed) {
            scheduleNext();
          }
        });
      pingInFlightRef.current = nextPing;
    };

    const maybeExtendSession = () => {
      if (Date.now() - lastExtendedAtRef.current >= SESSION_EXTEND_INTERVAL_MS) {
        extendSession();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        maybeExtendSession();
      }
    };

    const handleFocus = () => {
      maybeExtendSession();
    };

    lastExtendedAtRef.current = Date.now();
    scheduleNext();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      clearScheduled();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, userId]);
};
