import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--bg)] px-4 text-center text-[var(--text)]">
      <div className="mb-8">
        <Logo />
      </div>
      <p className="label mb-3">404 · off the map</p>
      <h1 className="h1 max-w-[16ch]">We couldn&apos;t find that route.</h1>
      <p className="mt-4 max-w-[42ch] text-base text-[var(--muted)]">
        The page or trip thread you&apos;re looking for may have moved or no
        longer exists.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="primary">
          <Link href="/app">Open planner</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
