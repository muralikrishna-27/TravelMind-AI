"use client";

import * as React from "react";

export interface UseDragScrollOptions {
  scrollerRef: React.RefObject<HTMLElement | null>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export interface UseDragScrollResult {
  isDragging: boolean;
  dragHandlers: {
    onPointerDown: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    onPointerUp: React.PointerEventHandler<HTMLElement>;
    onPointerCancel: React.PointerEventHandler<HTMLElement>;
    onClickCapture: React.MouseEventHandler<HTMLElement>;
  };
}

const DRAG_THRESHOLD_PX = 5;

export function useDragScroll({
  scrollerRef,
  onDragStart,
  onDragEnd,
}: UseDragScrollOptions): UseDragScrollResult {
  const [isDragging, setIsDragging] = React.useState(false);
  const stateRef = React.useRef<{
    pointerDown: boolean;
    pointerId: number | null;
    startX: number;
    startScrollLeft: number;
    dragged: boolean;
  }>({
    pointerDown: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    dragged: false,
  });

  const onPointerDown = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      if (event.pointerType === "touch" || event.button !== 0) {
        return;
      }
      const el = scrollerRef.current;
      if (!el) return;

      stateRef.current = {
        pointerDown: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: el.scrollLeft,
        dragged: false,
      };
      onDragStart?.();
    },
    [scrollerRef, onDragStart]
  );

  const onPointerMove = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      const state = stateRef.current;
      if (!state.pointerDown || event.pointerId !== state.pointerId) {
        return;
      }
      const el = scrollerRef.current;
      if (!el) return;

      const deltaX = event.clientX - state.startX;
      if (!state.dragged && Math.abs(deltaX) > DRAG_THRESHOLD_PX) {
        state.dragged = true;
        setIsDragging(true);
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          // Ignore pointer capture errors on synthetic events
        }
      }

      if (state.dragged) {
        event.preventDefault();
        el.scrollLeft = state.startScrollLeft - deltaX;
      }
    },
    [scrollerRef]
  );

  const finishDrag = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      const state = stateRef.current;
      if (!state.pointerDown) return;

      const el = scrollerRef.current;
      if (el && state.pointerId !== null) {
        try {
          if (el.hasPointerCapture(state.pointerId)) {
            el.releasePointerCapture(state.pointerId);
          }
        } catch {
          // Ignore release errors
        }
      }

      state.pointerDown = false;
      state.pointerId = null;
      setIsDragging(false);
      onDragEnd?.();
      void event;
    },
    [scrollerRef, onDragEnd]
  );

  const onClickCapture = React.useCallback<React.MouseEventHandler<HTMLElement>>(
    (event) => {
      if (stateRef.current.dragged) {
        event.preventDefault();
        event.stopPropagation();
        stateRef.current.dragged = false;
      }
    },
    []
  );

  return {
    isDragging,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onClickCapture,
    },
  };
}
