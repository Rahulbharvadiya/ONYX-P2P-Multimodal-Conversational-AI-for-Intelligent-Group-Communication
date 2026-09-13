"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLPreElement>(null);
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];

  const copy = async () => {
    const text = ref.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="group/code relative my-4">
      {lang && (
        <span className="absolute left-4 top-[11px] font-mono text-[10.5px] uppercase tracking-wide text-[--fg-subtle]">
          {lang}
        </span>
      )}
      <button
        onClick={copy}
        aria-label="Copy code"
        className={cn(
          "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-[--r-sm]",
          "border border-[--border] bg-[--surface] text-[--fg-muted] opacity-0",
          "transition-opacity duration-[--d-micro] hover:text-[--fg] group-hover/code:opacity-100",
          "focus-visible:opacity-100",
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[--success]" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre
        ref={ref}
        className={cn(
          "overflow-x-auto rounded-[--r-md] border border-[--border] bg-[--surface] px-4 pb-4",
          "font-mono text-[13px] leading-[1.65] text-[--fg]",
          lang ? "pt-9" : "pt-4",
        )}
      >
        {children}
      </pre>
    </div>
  );
}

/** Renders @ai and @name mentions as accent chips inside plain text. */
function withMentions(node: React.ReactNode): React.ReactNode {
  if (typeof node !== "string") return node;
  const parts = node.split(/(@[A-Za-z0-9_-]+)/g);
  if (parts.length === 1) return node;
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span
        key={i}
        className={cn(
          "rounded px-1 py-px font-medium",
          p.toLowerCase() === "@ai"
            ? "bg-[--accent-subtle] text-[--accent-text]"
            : "bg-[--bg-active] text-[--fg]",
        )}
      >
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

export const Markdown = React.memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat max-w-[68ch] text-[15px] text-[--fg]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) {
              return (
                <code
                  className={cn(
                    className,
                    "rounded-[--r-sm] border border-[--border] bg-[--surface] px-[5px] py-[1.5px]",
                    "font-mono text-[0.875em] text-[--fg]",
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <CodeBlock className={className}>
                <code className={className} {...props}>
                  {children}
                </code>
              </CodeBlock>
            );
          },
          p: ({ children }) => (
            <p className="mb-3.5 leading-[1.65] last:mb-0">
              {React.Children.map(children, withMentions)}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="mb-3 mt-7 text-[1.375rem] font-semibold leading-snug tracking-tight text-[--fg] first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-6 text-[1.1875rem] font-semibold leading-snug tracking-tight text-[--fg] first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-[1.0625rem] font-semibold leading-snug text-[--fg] first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1.5 mt-4 text-[0.9375rem] font-semibold leading-snug text-[--fg] first:mt-0">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="mb-1.5 mt-4 text-[0.9375rem] font-semibold leading-snug text-[--fg] first:mt-0">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="mb-1.5 mt-4 text-[0.8125rem] font-semibold uppercase tracking-wide text-[--fg-muted] first:mt-0">
              {children}
            </h6>
          ),
          ul: ({ children }) => (
            <ul className="mb-3.5 list-disc space-y-1.5 pl-5 marker:text-[--fg-subtle] last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3.5 list-decimal space-y-1.5 pl-5 marker:text-[--fg-subtle] last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1 leading-[1.65] [&>ul]:mt-1.5 [&>ol]:mt-1.5">
              {React.Children.map(children, withMentions)}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-[--border] py-0.5 pl-4 text-[--fg-muted] italic [&>p]:mb-2 [&>p:last-child]:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-[--border]" />,
          strong: ({ children }) => <strong className="font-semibold text-[--fg]">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-[--r-sm] border border-[--border]">
              <table className="w-full border-collapse text-[0.9em]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[--surface]">{children}</thead>,
          tr: ({ children }) => <tr className="border-b border-[--border] last:border-0">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-[--fg-muted]">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 align-top text-[--fg]">{children}</td>,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className="my-3 h-auto max-w-full rounded-[--r-sm] border border-[--border]"
            />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--fg] underline decoration-[--border] underline-offset-[3px] transition-colors duration-[--d-micro] hover:decoration-[--fg]"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});