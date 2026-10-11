import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onNewTrip?: () => void;
  className?: string;
}

export function ErrorState({
  title = "We couldn't finish planning this trip",
  message,
  onRetry,
  onNewTrip,
  className,
}: ErrorStateProps) {
  return (
    <Card
      role="alert"
      className={cn("mx-auto max-w-xl p-6 sm:p-8", className)}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <Badge variant="danger" dot>
          Interrupted
        </Badge>
      </div>
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle
            className="h-5 w-5 shrink-0 text-[var(--danger-fg)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <h2 className="h2 text-2xl text-[var(--text)]">{title}</h2>
        </div>
        <p className="max-w-[60ch] text-[15px] text-[var(--text-2)]">
          {message}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        )}
        {onNewTrip && (
          <Button variant="ghost" onClick={onNewTrip}>
            New trip
          </Button>
        )}
      </div>
    </Card>
  );
}
