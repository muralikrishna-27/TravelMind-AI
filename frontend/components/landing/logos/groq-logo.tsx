import * as React from "react";
import { cn } from "@/lib/utils";

export interface LogoSvgProps {
  className?: string;
}

export function GroqLogo({ className }: LogoSvgProps) {
  return (
    <svg
      viewBox="0 0 64 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-6 w-auto", className)}
    >
      <text
        x="2"
        y="17.5"
        fill="currentColor"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="19"
        fontWeight="700"
        letterSpacing="-0.04em"
      >
        groq
      </text>
    </svg>
  );
}
