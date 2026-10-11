"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname();
  const isMarketing = pathname === "/";

  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme={isMarketing ? "dark" : "system"}
      enableSystem
      storageKey="tm_theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
