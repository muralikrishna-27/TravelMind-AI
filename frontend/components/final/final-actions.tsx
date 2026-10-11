"use client";

import * as React from "react";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface FinalActionsProps {
  markdown: string;
  destination?: string | null;
  onDownloadPdf: () => Promise<void> | void;
  onNewTrip: () => void;
  isExportingPdf?: boolean;
}

export function FinalActions({
  markdown,
  onDownloadPdf,
  onNewTrip,
  isExportingPdf = false,
}: FinalActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6 space-y-5">
      <div>
        <Badge variant="live" dot className="mb-3">
          Approved
        </Badge>
        <h2 className="text-[18px] font-semibold text-text">
          Trip plan ready
        </h2>
        <p className="mt-1 text-[14px] leading-[1.5] text-muted">
          Your itinerary is locked in. Copy the markdown, download a clean PDF,
          or start planning another trip.
        </p>
      </div>

      <div className="space-y-2.5">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onDownloadPdf}
          loading={isExportingPdf}
          className="w-full rounded-pill gap-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download PDF
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={handleCopy}
          className="w-full rounded-pill gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-live" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy markdown
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="subtle"
          size="lg"
          onClick={onNewTrip}
          className="w-full rounded-pill gap-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Plan another trip
        </Button>
      </div>
    </div>
  );
}
