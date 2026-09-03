import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChatHistoryItemProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "title"
> & {
  selected: boolean;
  title: ReactNode;
  date: ReactNode;
  dateTime?: string;
  topBadge?: ReactNode;
  bottomBadge?: ReactNode;
};

export function ChatHistoryItem({
  selected,
  title,
  date,
  dateTime,
  topBadge,
  bottomBadge,
  className,
  ...buttonProps
}: ChatHistoryItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "focus-ring grid min-h-[5.25rem] w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-3 gap-y-1.5 border-b border-[color-mix(in_srgb,var(--border)_54%,transparent)] px-4 py-3 text-left transition-colors duration-200 active:bg-[var(--surface-muted)]",
        selected
          ? "bg-[var(--surface-muted)] text-[var(--foreground)] shadow-[inset_3px_0_0_var(--primary)]"
          : "hover:bg-[var(--surface-muted)]",
        className,
      )}
      {...buttonProps}
    >
      <span className="col-start-1 row-start-1 min-w-0 truncate text-sm font-semibold">
        {title}
      </span>
      {topBadge ? (
        <span className="col-start-2 row-start-1 min-w-0 max-w-full justify-self-end">
          {topBadge}
        </span>
      ) : null}
      <time
        className="col-start-1 row-start-2 min-w-0 truncate text-xs text-[var(--muted)]"
        dateTime={dateTime}
      >
        {date}
      </time>
      {bottomBadge ? (
        <span className="col-start-2 row-start-2 min-w-0 max-w-full justify-self-end">
          {bottomBadge}
        </span>
      ) : null}
    </button>
  );
}
