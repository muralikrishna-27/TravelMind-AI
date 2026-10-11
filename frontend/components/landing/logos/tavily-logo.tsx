import * as React from "react";
import { cn } from "@/lib/utils";

export interface LogoSvgProps {
  className?: string;
}

export function TavilyLogo({ className }: LogoSvgProps) {
  return (
    <svg
      viewBox="0 0 86 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-6 w-auto", className)}
    >
      <path
        d="M10 4.5L11.8 10.2L17.5 12L11.8 13.8L10 19.5L8.2 13.8L2.5 12L8.2 10.2L10 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
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
        Tavily
      </text>
    </svg>
  );
}
