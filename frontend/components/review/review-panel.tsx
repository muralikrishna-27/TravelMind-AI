"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ReviewPanelProps {
  dayCount: number;
  onApprove: () => void;
  onRevise: (feedback: string, selectedDays: number[]) => void;
  isSubmitting?: boolean;
  submittingAction?: "approve" | "revise" | null;
  className?: string;
}

export function ReviewPanel({
  dayCount,
  onApprove,
  onRevise,
  isSubmitting = false,
  submittingAction = null,
  className,
}: ReviewPanelProps) {
  const [feedback, setFeedback] = React.useState("");
  const [selectedDays, setSelectedDays] = React.useState<number[]>([]);
  const [allSelected, setAllSelected] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );

  const days = React.useMemo(
    () => Array.from({ length: Math.max(1, dayCount) }, (_, i) => i + 1),
    [dayCount]
  );

  const toggleDay = (day: number) => {
    setAllSelected(false);
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setAllSelected(false);
      setSelectedDays([]);
    } else {
      setAllSelected(true);
      setSelectedDays(days);
    }
  };

  const handleReviseClick = () => {
    const trimmed = feedback.trim();
    if (!trimmed) {
      setValidationError(
        "Tell the agents what to change before requesting a revision."
      );
      return;
    }
    setValidationError(null);

    let finalFeedback = trimmed;
    if (!allSelected && selectedDays.length > 0) {
      const hasExplicitDayMention = /\bday\s*\d+/i.test(trimmed);
      if (!hasExplicitDayMention) {
        const dayLabels = selectedDays.map((d) => `Day ${d}`).join(", ");
        finalFeedback = `${dayLabels}: ${trimmed}`;
      }
    }

    onRevise(finalFeedback, selectedDays);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-6 space-y-5",
        className
      )}
    >
      <div>
        <Badge variant="warn" dot className="mb-3">
          Awaiting your approval
        </Badge>
        <h2 className="text-[18px] font-semibold text-text">Your review</h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-muted">
          Approve to lock the plan, or tell the agents what to change. Only
          affected days will be regenerated.
        </p>
      </div>

      <div>
        <label htmlFor="review-feedback" className="label block mb-2">
          WHAT SHOULD CHANGE?
        </label>
        <Textarea
          id="review-feedback"
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            if (validationError) setValidationError(null);
          }}
          placeholder="e.g. Day 2 feels rushed. Swap teamLab for a slower afternoon in Yanaka."
          disabled={isSubmitting}
          rows={4}
          className="min-h-[104px] text-[14px]"
        />
        {validationError ? (
          <p role="alert" className="mt-1.5 text-[12px] text-danger-fg">
            {validationError}
          </p>
        ) : null}
      </div>

      {dayCount > 0 ? (
        <div>
          <p className="text-[12px] font-medium text-muted mb-2">
            Days to revise
          </p>
          <div className="flex flex-wrap gap-1.5">
            {days.map((d) => {
              const isSelected = !allSelected && selectedDays.includes(d);
              return (
                <Chip
                  key={d}
                  selected={isSelected}
                  onClick={() => toggleDay(d)}
                  disabled={isSubmitting}
                  className="px-3 py-1 text-[13px]"
                >
                  Day {d}
                </Chip>
              );
            })}
            <Chip
              selected={allSelected}
              onClick={toggleAll}
              disabled={isSubmitting}
              className="px-3 py-1 text-[13px]"
            >
              All
            </Chip>
          </div>
        </div>
      ) : null}

      <div className="space-y-2.5 pt-1">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onApprove}
          disabled={isSubmitting}
          loading={isSubmitting && submittingAction === "approve"}
          className="w-full rounded-pill font-medium"
        >
          Approve plan
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={handleReviseClick}
          disabled={isSubmitting}
          loading={isSubmitting && submittingAction === "revise"}
          className="w-full rounded-pill font-medium"
        >
          Request changes
        </Button>
      </div>
    </div>
  );
}
