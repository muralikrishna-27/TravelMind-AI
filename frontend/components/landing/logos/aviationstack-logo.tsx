import * as React from "react";
import { cn } from "@/lib/utils";

export interface LogoSvgProps {
  className?: string;
}

export function AviationStackLogo({ className }: LogoSvgProps) {
  return (
    <svg
      viewBox="0 0 148 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-6 w-auto", className)}
    >
      <path
        d="M10 5.5L17.5 9.5L10 13.5L2.5 9.5L10 5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 13.5L10 17.5L17.5 13.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="24"
        y="17"
        fill="currentColor"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="15.5"
        fontWeight="600"
        letterSpacing="-0.02em"
      >
        AviationStack
      </text>
    </svg>
  );
}
