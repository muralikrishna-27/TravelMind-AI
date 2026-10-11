"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavPillProps {
  className?: string;
}

export function NavPill({ className }: NavPillProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const headerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        headerRef.current &&
        event.target instanceof Node &&
        !headerRef.current.contains(event.target)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [mobileMenuOpen]);

  return (
    <header
      ref={headerRef}
      className={cn(
        "relative z-40 mx-auto w-full max-w-[var(--container)] px-4 pt-6 sm:px-6",
        className
      )}
    >
      <nav
        aria-label="Primary navigation"
        className="flex items-center justify-between gap-3 rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 backdrop-blur-md sm:px-5"
      >
        {/* Left spacer on mobile so TravelMind stays centered */}
        <div className="h-[38px] w-[38px] shrink-0 sm:hidden" aria-hidden="true" />

        <Logo href="/" showIcon={false} className="text-base font-semibold" />

        <div className="hidden items-center gap-6 text-sm text-[var(--muted)] sm:flex">
          <Link
            href="#agents"
            className="transition-colors duration-[var(--dur-1)] hover:text-[var(--text)]"
          >
            Agents
          </Link>
          <Link
            href="#how-it-works"
            className="transition-colors duration-[var(--dur-1)] hover:text-[var(--text)]"
          >
            How it works
          </Link>
        </div>

        <div className="hidden items-center gap-2.5 sm:flex">
          <ThemeToggle />
          <Button asChild variant="primary" size="sm" className="min-h-[38px] px-4">
            <Link href="/app">Get started</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls="landing-mobile-menu"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors duration-[var(--dur-1)] ease-[var(--ease)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] cursor-pointer sm:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Menu className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div
          id="landing-mobile-menu"
          className="mt-2 flex flex-col gap-1.5 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)]/95 p-4 backdrop-blur-md sm:hidden"
        >
          <Link
            href="#agents"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-[var(--r-sm)] px-3 py-2.5 text-sm font-medium text-[var(--text-2)] transition-colors duration-[var(--dur-1)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            Agents
          </Link>
          <Link
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-[var(--r-sm)] px-3 py-2.5 text-sm font-medium text-[var(--text-2)] transition-colors duration-[var(--dur-1)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            How it works
          </Link>

          <div className="my-1.5 h-px bg-[var(--border)]" />

          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-sm text-[var(--muted)]">Appearance</span>
            <ThemeToggle />
          </div>

          <Button
            asChild
            variant="primary"
            size="sm"
            className="mt-2 min-h-[42px] w-full justify-center px-4"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Link href="/app">Get started</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
