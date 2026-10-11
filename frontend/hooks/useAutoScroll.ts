"use client";

import * as React from "react";

export interface UseAutoScrollOptions {
  scrollerRef: React.RefObject<HTMLElement | null>;
  sectionRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  speedPxPerFrame?: number;
  resumeDelayMs?: number;
  getLoopWidth?: () => number;
}

export interface UseAutoScrollResult {
  userPaused: boolean;
  isPaused: boolean;
  toggleUserPause: () => void;
  notifyInteractionStart: () => void;
  notifyInteractionEnd: () => void;
  notifyTransientInteraction: () => void;
  interactionHandlers: {
    onMouseEnter: React.MouseEventHandler<HTMLElement>;
    onMouseLeave: React.MouseEventHandler<HTMLElement>;
    onFocusCapture: React.FocusEventHandler<HTMLElement>;
    onBlurCapture: React.FocusEventHandler<HTMLElement>;
    onTouchStart: React.TouchEventHandler<HTMLElement>;
    onTouchEnd: React.TouchEventHandler<HTMLElement>;
    onTouchCancel: React.TouchEventHandler<HTMLElement>;
  };
}

export function useAutoScroll({
  scrollerRef,
  sectionRef,
  disabled = false,
  speedPxPerFrame = 0.4,
  resumeDelayMs = 2000,
  getLoopWidth,
}: UseAutoScrollOptions): UseAutoScrollResult {
  const [userPaused, setUserPaused] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isInteracting, setIsInteracting] = React.useState(false);
  const [isCoolingDown, setIsCoolingDown] = React.useState(false);
  const [isInView, setIsInView] = React.useState(true);
  const [isTabVisible, setIsTabVisible] = React.useState(true);

  const resumeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const getLoopWidthRef = React.useRef(getLoopWidth);
  React.useEffect(() => {
    getLoopWidthRef.current = getLoopWidth;
  }, [getLoopWidth]);

  const clearResumeTimer = React.useCallback(() => {
    if (resumeTimerRef.current !== null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const scheduleResume = React.useCallback(() => {
    clearResumeTimer();
    setIsCoolingDown(true);
    resumeTimerRef.current = setTimeout(() => {
      setIsCoolingDown(false);
      resumeTimerRef.current = null;
    }, resumeDelayMs);
  }, [clearResumeTimer, resumeDelayMs]);

  React.useEffect(() => {
    return () => {
      clearResumeTimer();
    };
  }, [clearResumeTimer]);

  // Track document visibility
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Track IntersectionObserver for off-screen pause
  React.useEffect(() => {
    const target = sectionRef.current ?? scrollerRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsInView(entry.isIntersecting);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [sectionRef, scrollerRef]);

  const isPaused =
    disabled ||
    userPaused ||
    isHovered ||
    isFocused ||
    isInteracting ||
    isCoolingDown ||
    !isInView ||
    !isTabVisible;

  // rAF loop on the native scroller
  React.useEffect(() => {
    if (isPaused) return;
    const el = scrollerRef.current;
    if (!el) return;

    let rafId = 0;
    let subPixelAccumulator = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const node = scrollerRef.current;
      if (!node) return;

      const dt = Math.min(Math.max(now - lastTime, 4), 48);
      lastTime = now;

      subPixelAccumulator += speedPxPerFrame * (dt / 16.6667);
      if (subPixelAccumulator >= 1) {
        const deltaPx = Math.floor(subPixelAccumulator);
        subPixelAccumulator -= deltaPx;

        const loopWidth =
          getLoopWidthRef.current?.() ?? Math.floor(node.scrollWidth / 2);

        if (loopWidth > 0 && node.scrollLeft + deltaPx >= loopWidth) {
          node.scrollLeft = node.scrollLeft + deltaPx - loopWidth;
        } else {
          node.scrollLeft += deltaPx;
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPaused, scrollerRef, speedPxPerFrame]);

  const toggleUserPause = React.useCallback(() => {
    setUserPaused((prev) => !prev);
  }, []);

  const notifyInteractionStart = React.useCallback(() => {
    clearResumeTimer();
    setIsInteracting(true);
  }, [clearResumeTimer]);

  const notifyInteractionEnd = React.useCallback(() => {
    setIsInteracting(false);
    scheduleResume();
  }, [scheduleResume]);

  const notifyTransientInteraction = React.useCallback(() => {
    scheduleResume();
  }, [scheduleResume]);

  const onMouseEnter = React.useCallback<React.MouseEventHandler<HTMLElement>>(() => {
    clearResumeTimer();
    setIsHovered(true);
  }, [clearResumeTimer]);

  const onMouseLeave = React.useCallback<React.MouseEventHandler<HTMLElement>>(() => {
    setIsHovered(false);
    scheduleResume();
  }, [scheduleResume]);

  const onFocusCapture = React.useCallback<React.FocusEventHandler<HTMLElement>>(() => {
    clearResumeTimer();
    setIsFocused(true);
  }, [clearResumeTimer]);

  const onBlurCapture = React.useCallback<React.FocusEventHandler<HTMLElement>>(
    (event) => {
      const container = sectionRef.current ?? scrollerRef.current;
      if (
        container &&
        event.relatedTarget instanceof Node &&
        container.contains(event.relatedTarget)
      ) {
        return;
      }
      setIsFocused(false);
      scheduleResume();
    },
    [sectionRef, scrollerRef, scheduleResume]
  );

  const onTouchStart = React.useCallback<React.TouchEventHandler<HTMLElement>>(() => {
    clearResumeTimer();
    setIsInteracting(true);
  }, [clearResumeTimer]);

  const onTouchEnd = React.useCallback<React.TouchEventHandler<HTMLElement>>(() => {
    setIsInteracting(false);
    scheduleResume();
  }, [scheduleResume]);

  return {
    userPaused,
    isPaused,
    toggleUserPause,
    notifyInteractionStart,
    notifyInteractionEnd,
    notifyTransientInteraction,
    interactionHandlers: {
      onMouseEnter,
      onMouseLeave,
      onFocusCapture,
      onBlurCapture,
      onTouchStart,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
  };
}
