import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

export interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  if (!content || !content.trim()) return null;

  return (
    <div
      className={cn(
        "text-[15px] leading-[1.6] text-text-2 space-y-3",
        "[&_h1]:font-serif [&_h1]:text-[28px] [&_h1]:text-text [&_h1]:mt-4 [&_h1]:mb-2",
        "[&_h2]:font-serif [&_h2]:text-[24px] [&_h2]:text-text [&_h2]:mt-4 [&_h2]:mb-2",
        "[&_h3]:font-sans [&_h3]:font-semibold [&_h3]:text-[16px] [&_h3]:text-text [&_h3]:mt-3 [&_h3]:mb-1.5",
        "[&_p]:leading-[1.6] [&_p]:text-text-2",
        "[&_strong]:font-semibold [&_strong]:text-text",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5",
        "[&_li]:text-text-2",
        "[&_a]:text-text [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-live",
        "[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-[6px]",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px] [&_table]:my-3",
        "[&_th]:border-b [&_th]:border-border-strong [&_th]:py-2 [&_th]:px-3 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted",
        "[&_td]:border-b [&_td]:border-border [&_td]:py-2.5 [&_td]:px-3 [&_td]:align-top [&_td]:text-text-2",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
