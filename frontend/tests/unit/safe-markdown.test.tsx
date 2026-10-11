import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SafeMarkdown } from "@/components/review/safe-markdown";

describe("SafeMarkdown XSS sanitization", () => {
  it("strips <script> tags, inline event handlers, and javascript: URLs from malicious markdown", () => {
    const malicious = [
      "### Day 1 – Arrival",
      "",
      "<script>window.__xss = true;</script>",
      "",
      '<img src="x" onerror="alert(1)" />',
      "",
      "[Click me](javascript:alert('xss'))",
      "",
      "Normal **safe** text.",
    ].join("\n");

    const { container } = render(<SafeMarkdown content={malicious} />);
    expect(container.querySelector("script")).toBeNull();
    const img = container.querySelector("img");
    if (img) {
      expect(img.getAttribute("onerror")).toBeNull();
    }
    const anchor = container.querySelector("a");
    if (anchor) {
      expect(anchor.getAttribute("href") ?? "").not.toContain("javascript:");
    }
    expect(container.textContent).toContain("Day 1 – Arrival");
    expect(container.textContent).toContain("Normal safe text.");
  });
});
