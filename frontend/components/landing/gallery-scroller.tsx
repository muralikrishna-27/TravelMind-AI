"use client";

import * as React from "react";
import { GalleryCard } from "@/components/landing/GalleryCard";
import { GALLERY_CARDS } from "@/components/landing/gallery-cards";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

export interface GalleryScrollerProps {
  className?: string;
}

export function GalleryScroller({ className }: GalleryScrollerProps) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const firstPrimaryRef = React.useRef<HTMLDivElement>(null);
  const secondPrimaryRef = React.useRef<HTMLDivElement>(null);
  const firstCloneRef = React.useRef<HTMLDivElement>(null);

  const reducedMotion = useReducedMotion();
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const getCardStep = React.useCallback((): number => {
    if (firstPrimaryRef.current && secondPrimaryRef.current) {
      const step =
        secondPrimaryRef.current.offsetLeft - firstPrimaryRef.current.offsetLeft;
      if (step > 0) return step;
    }
    if (firstPrimaryRef.current) {
      return firstPrimaryRef.current.offsetWidth + 16;
    }
    return 256;
  }, []);

  const getLoopWidth = React.useCallback((): number => {
    if (firstPrimaryRef.current && firstCloneRef.current) {
      const width =
        firstCloneRef.current.offsetLeft - firstPrimaryRef.current.offsetLeft;
      if (width > 0) return width;
    }
    const el = scrollerRef.current;
    return el ? Math.floor(el.scrollWidth / 2) : 0;
  }, []);

  const updateScrollBounds = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextAtStart = el.scrollLeft <= 2;
    const nextAtEnd = maxScroll <= 2 || el.scrollLeft >= maxScroll - 2;
    setAtStart((prev) => (prev === nextAtStart ? prev : nextAtStart));
    setAtEnd((prev) => (prev === nextAtEnd ? prev : nextAtEnd));
  }, []);

  const {
    isPaused,
    notifyInteractionStart,
    notifyInteractionEnd,
    notifyTransientInteraction,
    interactionHandlers,
  } = useAutoScroll({
    scrollerRef,
    sectionRef,
    disabled: reducedMotion,
    speedPxPerFrame: 0.6,
    resumeDelayMs: 2000,
    getLoopWidth,
  });

  const { isDragging, dragHandlers } = useDragScroll({
    scrollerRef,
    onDragStart: notifyInteractionStart,
    onDragEnd: notifyInteractionEnd,
  });

  React.useEffect(() => {
    updateScrollBounds();
    const el = scrollerRef.current;
    if (!el) return;

    const handleResize = () => updateScrollBounds();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateScrollBounds, reducedMotion]);

  const handleScroll = React.useCallback(() => {
    const el = scrollerRef.current;
    if (el && !reducedMotion) {
      const loopWidth = getLoopWidth();
      if (loopWidth > 0 && el.scrollLeft >= loopWidth) {
        el.scrollLeft -= loopWidth;
      }
    }
    updateScrollBounds();
  }, [getLoopWidth, reducedMotion, updateScrollBounds]);

  const handleWheel = React.useCallback<React.WheelEventHandler<HTMLDivElement>>(
    (event) => {
      notifyTransientInteraction();
      const el = scrollerRef.current;
      if (!el) return;
      if (event.shiftKey && event.deltaY !== 0 && event.deltaX === 0) {
        event.preventDefault();
        el.scrollLeft += event.deltaY;
        updateScrollBounds();
      }
    },
    [notifyTransientInteraction, updateScrollBounds]
  );

  const handleKeyDown = React.useCallback<
    React.KeyboardEventHandler<HTMLDivElement>
  >(
    (event) => {
      const el = scrollerRef.current;
      if (!el) return;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const step = getCardStep();

      if (event.key === "ArrowRight") {
        event.preventDefault();
        notifyTransientInteraction();
        el.scrollLeft = Math.min(maxScroll, el.scrollLeft + step);
        updateScrollBounds();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        notifyTransientInteraction();
        el.scrollLeft = Math.max(0, el.scrollLeft - step);
        updateScrollBounds();
      } else if (event.key === "Home") {
        event.preventDefault();
        notifyTransientInteraction();
        el.scrollLeft = 0;
        updateScrollBounds();
      } else if (event.key === "End") {
        event.preventDefault();
        notifyTransientInteraction();
        el.scrollLeft = maxScroll;
        updateScrollBounds();
      }
    },
    [getCardStep, notifyTransientInteraction, updateScrollBounds]
  );

  return (
    <section
      ref={sectionRef}
      aria-label="Sample agent outputs"
      className={cn(
        "mx-auto w-full max-w-[var(--container)] pt-6 pb-8 sm:pt-8 sm:pb-12",
        className
      )}
      {...interactionHandlers}
    >
      <div
        ref={scrollerRef}
        role="region"
        aria-label="Sample agent output cards"
        tabIndex={0}
        data-at-start={atStart ? "true" : "false"}
        data-at-end={atEnd ? "true" : "false"}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        {...dragHandlers}
        className={cn(
          "gallery-mask no-scrollbar flex gap-4 overflow-x-auto overscroll-x-contain px-4 scroll-px-4 pt-1 pb-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] sm:px-6 sm:scroll-px-6",
          isPaused && !isDragging ? "snap-x snap-proximity" : "snap-none",
          isDragging ? "cursor-grabbing select-none" : "cursor-grab"
        )}
      >
        {GALLERY_CARDS.map((card, index) => (
          <GalleryCard
            key={card.id}
            ref={
              index === 0
                ? firstPrimaryRef
                : index === 1
                  ? secondPrimaryRef
                  : undefined
            }
            card={card}
            staggered={index % 2 === 1}
          />
        ))}

        {!reducedMotion &&
          GALLERY_CARDS.map((card, index) => (
            <GalleryCard
              key={`clone-${card.id}`}
              ref={index === 0 ? firstCloneRef : undefined}
              card={card}
              staggered={index % 2 === 1}
              isClone
            />
          ))}
      </div>
    </section>
  );
}
