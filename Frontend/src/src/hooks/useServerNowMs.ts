"use client";

import { useEffect, useRef, useState } from "react";

const parseMs = (value?: string | null): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export const useServerNowMs = (
  serverTime?: string | null,
  tickMs = 1000
): number | null => {
  const offsetRef = useRef<number | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(() => parseMs(serverTime));

  useEffect(() => {
    const serverMs = parseMs(serverTime);
    if (serverMs === null) return;
    offsetRef.current = serverMs - Date.now();
    setNowMs(Date.now() + offsetRef.current);
  }, [serverTime]);

  useEffect(() => {
    if (tickMs <= 0) return;

    const updateNow = () => {
      if (offsetRef.current === null) return;
      setNowMs(Date.now() + offsetRef.current);
    };

    updateNow();
    const id = window.setInterval(updateNow, tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return nowMs;
};
