"use client";

import * as React from "react";
import { checkBackendHealth } from "@/lib/api";

export type HealthStatus = "online" | "degraded" | "offline";

export function useHealth(pollIntervalMs = 30000): {
  status: HealthStatus;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = React.useState<HealthStatus>("online");

  const refresh = React.useCallback(async () => {
    try {
      const res = await checkBackendHealth();
      if (res.status === "ok") {
        setStatus("online");
      } else {
        setStatus("degraded");
      }
    } catch {
      setStatus("offline");
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await checkBackendHealth();
        if (!active) return;
        setStatus(res.status === "ok" ? "online" : "degraded");
      } catch {
        if (!active) return;
        setStatus("offline");
      }
    };

    void check();
    const id = window.setInterval(() => {
      void check();
    }, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [pollIntervalMs]);

  return { status, refresh };
}
