"use client";

import { useCallback, useEffect, useState } from "react";

export function useSessionStorage<T>(
  key: string,
  initial: T | (() => T)
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return typeof initial === "function" ? (initial as () => T)() : initial;
    }
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw == null) {
        return typeof initial === "function" ? (initial as () => T)() : initial;
      }
      return JSON.parse(raw) as T;
    } catch {
      return typeof initial === "function" ? (initial as () => T)() : initial;
    }
  });

  useEffect(() => {
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
