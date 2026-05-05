"use client";

import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  return (
    <Input
      type="search"
      placeholder="Search Spotify for a track…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
