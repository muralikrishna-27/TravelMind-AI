import { NavPill } from "@/components/landing/nav-pill";
import { Hero } from "@/components/landing/hero";
import { GalleryScroller } from "@/components/landing/gallery-scroller";
import { ControlCards } from "@/components/landing/control-cards";
import { AgentGrid } from "@/components/landing/agent-grid";
import { CtaPanel } from "@/components/landing/cta-panel";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px]"
        style={{
          background:
            "radial-gradient(ellipse 90% 100% at 50% 0%, var(--glow) 0%, var(--bg) 75%)",
        }}
      />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <NavPill />
        <main className="flex-1">
          <Hero />
          <GalleryScroller />
          <ControlCards />
          <AgentGrid />
          <CtaPanel />
        </main>
        <Footer />
      </div>
    </div>
  );
}
