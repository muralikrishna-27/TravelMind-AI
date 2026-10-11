import * as React from "react";
import { cn } from "@/lib/utils";

export interface LogoSvgProps {
  className?: string;
}

export function LangGraphLogo({ className }: LogoSvgProps) {
  return (
    <svg
      viewBox="0 0 132 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-6 w-auto", className)}
    >
      <circle cx="5" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15" cy="6.5" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15" cy="17.5" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M7 10.9L13 7.6M7 13.1L13 16.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
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
        LangGraph
      </text>
    </svg>
  );
}
