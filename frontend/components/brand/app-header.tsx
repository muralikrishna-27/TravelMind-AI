"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { StatusPill } from "@/components/brand/status-pill";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { OfflineBanner } from "@/components/states/offline-banner";
import { useHealth } from "@/hooks/use-health";
import { clearLegacyThreadStorage } from "@/lib/threads";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  tripSummaryPill?: string;
  onNewTrip?: () => void;
  showStatusPill?: boolean;
  className?: string;
}

export function AppHeader({
  tripSummaryPill,
  onNewTrip,
  showStatusPill = true,
  className,
}: AppHeaderProps) {
  const router = useRouter();
  const { status, refresh } = useHealth();
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

  const handleNewTrip = () => {
    setMobileMenuOpen(false);
    clearLegacyThreadStorage();
    if (onNewTrip) {
      onNewTrip();
    } else {
      router.push("/app");
    }
  };

  return (
    <>
      {status === "offline" && <OfflineBanner onRetry={refresh} />}
      <header
        ref={headerRef}
        className={cn(
          "no-print relative z-40 mx-auto w-full max-w-[var(--container-app)] px-4 py-5 sm:px-6",
          className
        )}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left spacer on mobile so TravelMind stays centered */}
          <div className="h-[38px] w-[38px] shrink-0 sm:hidden" aria-hidden="true" />

          <Logo href="/" showIcon />

          <div className="hidden items-center gap-3 sm:flex sm:gap-4">
            {tripSummaryPill ? (
              <Chip
                asSpan
                className="min-h-[38px] px-4 py-1.5 text-sm"
              >
                {tripSummaryPill}
              </Chip>
            ) : (
              showStatusPill && (
                <StatusPill status={status} />
              )
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewTrip}
              className="min-h-[38px] px-4"
            >
              New trip
            </Button>
            <ThemeToggle />
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="app-mobile-menu"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors duration-[var(--dur-1)] ease-[var(--ease)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] cursor-pointer sm:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            id="app-mobile-menu"
            className="mt-3 flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)]/95 p-4 backdrop-blur-md sm:hidden"
          >
            {tripSummaryPill ? (
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Current trip
                </span>
                <Chip asSpan className="px-3 py-1 text-xs">
                  {tripSummaryPill}
                </Chip>
              </div>
            ) : (
              showStatusPill && (
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-sm text-[var(--muted)]">Status</span>
                  <StatusPill status={status} />
                </div>
              )
            )}

            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm text-[var(--muted)]">Appearance</span>
              <ThemeToggle />
            </div>

            <div className="my-1 h-px bg-[var(--border)]" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewTrip}
              className="min-h-[40px] w-full justify-center px-4"
            >
              New trip
            </Button>
          </div>
        )}
      </header>
    </>
  );
}
