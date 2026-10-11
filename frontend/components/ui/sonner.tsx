"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) || "system"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--surface)] group-[.toaster]:text-[var(--text)] group-[.toaster]:border-[var(--border)] group-[.toaster]:rounded-[var(--r-md)]",
          description: "group-[.toast]:text-[var(--muted)]",
          actionButton:
            "group-[.toast]:bg-[var(--primary-bg)] group-[.toast]:text-[var(--primary-fg)]",
          cancelButton:
            "group-[.toast]:bg-[var(--surface-2)] group-[.toast]:text-[var(--text-2)]",
        },
      }}
      {...props}
    />
  );
}
