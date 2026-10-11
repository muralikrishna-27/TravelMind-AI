import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "card" | "pill";
}

export function Skeleton({
  className,
  variant = "text",
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "motion-safe:animate-pulse bg-[var(--surface-2)]",
        variant === "text" && "h-4 w-full rounded-[var(--r-sm)]",
        variant === "card" && "h-36 w-full rounded-[var(--r-lg)]",
        variant === "pill" && "h-9 w-24 rounded-[var(--r-pill)]",
        className
      )}
      {...props}
    />
  );
}

export function ItinerarySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading trip itinerary"
      className="mx-auto w-full max-w-[var(--container-app)] px-4 py-8 sm:px-6"
    >
      <div className="mb-6 flex flex-col gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="mb-6 flex gap-2">
        <Skeleton variant="pill" />
        <Skeleton variant="pill" />
        <Skeleton variant="pill" />
      </div>
      <Card className="p-6">
        <Skeleton className="mb-3 h-3 w-16" />
        <Skeleton className="mb-6 h-8 w-56" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    </div>
  );
}
