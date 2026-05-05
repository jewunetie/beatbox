"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSessionStorage<T>(
  key: string,
  initial: T | (() => T)
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() =>
    typeof initial === "function" ? (initial as () => T)() : initial
  );
  // Track whether the initial sessionStorage read has run so we can skip the
  // first write-back that would otherwise overwrite stored data with the
  // default before we've loaded it.
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw != null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      /* ignore */
    } finally {
      hydratedRef.current = true;
    }
    // Read once on mount per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or disabled storage — ignore */
    }
  }, [key, value]);

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

  return [value, update, remove];
}
