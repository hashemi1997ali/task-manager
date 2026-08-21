import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export function ChatMessageBubble({
  id,
  direction,
  content,
  name,
  nameHref,
  createdAt,
  markdown = false,
  typing = false,
}: {
  id?: string;
  direction: "incoming" | "outgoing" | "system";
  content: string;
  name?: string | null;
  nameHref?: string | null;
  createdAt?: string | Date | null;
  markdown?: boolean;
  typing?: boolean;
}) {
  if (direction === "system") {
    return (
      <div id={id} className="flex items-center justify-center gap-3 px-2 py-1">
        <span className="h-px max-w-16 flex-1 bg-[var(--border)]" aria-hidden="true" />
        <p
          className="w-fit max-w-[82%] rounded-full border bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-5 text-[var(--muted)] shadow-sm"
          dir="auto"
        >
          {content}
        </p>
        <span className="h-px max-w-16 flex-1 bg-[var(--border)]" aria-hidden="true" />
      </div>
    );
  }

  const time = createdAt
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(createdAt),
      )
    : null;

  return (
    <div
      id={id}
      className={cn(
        "flex px-0.5",
        direction === "outgoing" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "w-fit max-w-[88%] px-4 py-3 text-sm leading-6",
          direction === "outgoing"
            ? "rounded-[1.25rem] rounded-br-md bg-[var(--foreground)] text-[var(--background)] shadow-[0_10px_26px_rgb(12_12_22_/_0.12)]"
            : "rounded-[1.25rem] rounded-bl-md border bg-[var(--surface)] text-[var(--foreground)] shadow-[0_8px_24px_rgb(34_28_76_/_0.05)]",
        )}
      >
        {name &&
          (nameHref ? (
            <Link
              href={nameHref}
              className={cn(
                "mb-1.5 block w-fit rounded text-[0.6875rem] font-semibold tracking-wide transition-colors hover:opacity-80",
                direction === "outgoing"
                  ? "text-current opacity-75"
                  : "text-[var(--primary)]",
              )}
            >
              {name}
            </Link>
          ) : (
            <p
              className={cn(
                "mb-1.5 text-[0.6875rem] font-semibold tracking-wide",
                direction === "outgoing"
                  ? "text-current opacity-75"
                  : "text-[var(--primary)]",
              )}
            >
              {name}
            </p>
          ))}
        {typing && !content ? (
          <span className="flex h-5 items-center gap-1" role="status">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="size-1.5 animate-pulse rounded-full bg-[var(--muted)] motion-reduce:animate-none"
                style={{ animationDelay: `${index * 140}ms` }}
              />
            ))}
          </span>
        ) : markdown ? (
          <div className="chat-markdown break-words [overflow-wrap:anywhere]" dir="auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const external = href?.startsWith("http");
                  return (
                    <a
                      href={href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noreferrer noopener" : undefined}
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p
            className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            dir="auto"
          >
            {content}
          </p>
        )}
        {typing && content ? (
          <span
            className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-current align-middle opacity-45 motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        {time && (
          <p
            className={cn(
              "mt-1.5 text-right text-[0.625rem] leading-none font-medium tracking-wide tabular-nums",
              direction === "outgoing"
                ? "text-current opacity-70"
                : "text-[var(--muted)]",
            )}
          >
            {time}
          </p>
        )}
      </div>
    </div>
  );
}
