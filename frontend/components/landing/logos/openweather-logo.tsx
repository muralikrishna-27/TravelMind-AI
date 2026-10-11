import * as React from "react";
import { cn } from "@/lib/utils";

export interface LogoSvgProps {
  className?: string;
}

export function OpenWeatherLogo({ className }: LogoSvgProps) {
  return (
    <svg
      viewBox="0 0 148 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-6 w-auto", className)}
    >
      <circle cx="10" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 5V6.6M10 17.4V19M3 12H4.6M15.4 12H17M5.05 7.05L6.2 8.2M13.8 15.8L14.95 16.95M14.95 7.05L13.8 8.2M6.2 15.8L5.05 16.95"
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
        OpenWeather
      </text>
    </svg>
  );
}
