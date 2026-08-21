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
        "focus-ring grid min-h-24 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-3 gap-y-2 border-b px-4 py-3 text-left transition-colors duration-200 active:bg-[var(--primary-soft)]/60",
        selected
          ? "bg-[color-mix(in_srgb,var(--primary-soft)_72%,var(--surface))] text-[var(--foreground)] shadow-[inset_3px_0_0_var(--primary)]"
          : "hover:bg-[color-mix(in_srgb,var(--surface-muted)_76%,var(--primary-soft))]",
        className,
      )}
      {...buttonProps}
    >
      <span className="col-start-1 row-start-1 min-w-0 truncate pr-2 text-sm font-semibold tracking-[-0.01em] group-hover:text-[var(--foreground)]">
        {title}
      </span>
      {topBadge ? (
        <span className="col-start-2 row-start-1 min-w-0 max-w-full justify-self-end">
          {topBadge}
        </span>
      ) : null}
      <time
        className="col-start-1 row-start-2 min-w-0 truncate text-[0.6875rem] font-medium tracking-wide text-[var(--muted)] tabular-nums"
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
