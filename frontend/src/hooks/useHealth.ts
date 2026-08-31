import { useCallback, useEffect, useRef } from "react";
import { fetchHealth } from "../services/api";
import { useHealthStore } from "../stores/health";

export function useHealth(pollMs = 15000) {
  const { data, loading, error, setLoading, setData, setError } = useHealthStore();
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetchHealth(ctrl.signal);
      setData(res);
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setData, setError, setLoading]);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
  }, [pollMs, refresh]);

  return { data, loading, error, refresh };
}
