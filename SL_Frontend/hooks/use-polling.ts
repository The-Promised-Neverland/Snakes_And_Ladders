"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval: number;
  enabled: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
}

export function usePolling<T>({
  fetcher,
  interval,
  enabled,
  onSuccess,
  onError,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setIsSyncing(true);
    try {
      const result = await fetcher();
      if (!mountedRef.current) return;
      
      setData(result);
      setError(null);
      onSuccess?.(result);
    } catch (err) {
      if (!mountedRef.current) return;
      
      setError(err);
      onError?.(err);
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [fetcher, onSuccess, onError]);

  const refetch = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await poll();
    if (enabled && mountedRef.current) {
      timeoutRef.current = setTimeout(refetch, interval);
    }
  }, [poll, enabled, interval]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      poll();
      const scheduleNext = () => {
        timeoutRef.current = setTimeout(async () => {
          await poll();
          if (enabled && mountedRef.current) {
            scheduleNext();
          }
        }, interval);
      };
      scheduleNext();
    }

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, interval, poll]);

  return { data, error, isSyncing, refetch };
}
