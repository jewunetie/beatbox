"use client";

import { useCallback, useEffect, useState } from "react";

export function useSessionStorage<T>(
  key: string,
  initial: T | (() => T)
): [T, (next: T | ((prev: T) => T)) => void, () => void, boolean] {
  const [value, setValue] = useState<T>(() =>
    typeof initial === "function" ? (initial as () => T)() : initial
  );
  // ready flips true after the first sessionStorage read so callers can skip
  // any UI that would otherwise flash before stored values are restored.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw != null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      /* ignore */
    } finally {
      setReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or disabled storage — ignore */
    }
  }, [key, value, ready]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) =>
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next
      );
    },
    []
  );

  const remove = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return [value, update, remove, ready];
}
