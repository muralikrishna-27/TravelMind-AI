"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ReviewPanel } from "@/components/review/review-panel";

export interface StickyActionBarProps {
  dayCount: number;
  onApprove: () => void;
  onRevise: (feedback: string, selectedDays: number[]) => void;
  isSubmitting?: boolean;
  submittingAction?: "approve" | "revise" | null;
}

export function StickyActionBar({
  dayCount,
  onApprove,
  onRevise,
  isSubmitting = false,
  submittingAction = null,
}: StickyActionBarProps) {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const handleReviseSubmit = (feedback: string, selectedDays: number[]) => {
    setSheetOpen(false);
    onRevise(feedback, selectedDays);
  };

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur-md lg:hidden"
        style={{
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setSheetOpen(true)}
            disabled={isSubmitting}
            className="flex-1 rounded-pill"
          >
            Revise
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onApprove}
            disabled={isSubmitting}
            loading={isSubmitting && submittingAction === "approve"}
            className="flex-1 rounded-pill"
          >
            Approve
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto p-5">
          <SheetTitle className="sr-only">Revise itinerary</SheetTitle>
          <SheetDescription className="sr-only">
            Tell the agents what to change or approve the plan.
          </SheetDescription>
          <ReviewPanel
            dayCount={dayCount}
            onApprove={() => {
              setSheetOpen(false);
              onApprove();
            }}
            onRevise={handleReviseSubmit}
            isSubmitting={isSubmitting}
            submittingAction={submittingAction}
            className="border-0 p-0 shadow-none"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
