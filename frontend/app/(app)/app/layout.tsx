import * as React from "react";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">
      {children}
    </div>
  );
}
