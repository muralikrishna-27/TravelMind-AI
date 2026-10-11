import * as React from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogoProps {
  href?: string;
  showIcon?: boolean;
  className?: string;
}

export function Logo({
  href = "/",
  showIcon = true,
  className,
}: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--r-sm)] text-[17px] font-semibold tracking-[-0.02em] text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text)]",
        className
      )}
    >
      {showIcon && (
        <Send
          className="h-4 w-4 -rotate-12 text-[var(--text)]"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}
      <span>TravelMind</span>
    </Link>
  );
}
