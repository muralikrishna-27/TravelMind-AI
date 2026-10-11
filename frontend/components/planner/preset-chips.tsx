"use client";

import * as React from "react";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

export interface PresetPromptItem {
  label: string;
  prompt: string;
}

export const DEFAULT_PRESETS: PresetPromptItem[] = [
  {
    label: "Japan, 5 days",
    prompt:
      "5 days in Tokyo, mid-range budget, love food and temples",
  },
  {
    label: "Dubai weekend",
    prompt:
      "Plan a 4 days Dubai trip from Hyderabad with flights, hotels and sightseeing",
  },
  {
    label: "Thailand on a budget",
    prompt:
      "Plan a 7 days Thailand trip from Hyderabad with budget hotels and sightseeing",
  },
  {
    label: "Flights to Lisbon",
    prompt:
      "Plan a 5 days Lisbon trip including flights, boutique stays, weather and local food",
  },
];

export interface PresetChipsProps {
  presets?: PresetPromptItem[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

export function PresetChips({
  presets = DEFAULT_PRESETS,
  onSelect,
  disabled = false,
  className,
}: PresetChipsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2.5",
        className
      )}
    >
      {presets.map((item) => (
        <Chip
          key={item.label}
          disabled={disabled}
          onClick={() => onSelect(item.prompt)}
        >
          {item.label}
        </Chip>
      ))}
    </div>
  );
}
