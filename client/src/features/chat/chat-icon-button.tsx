import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function ChatIconButton({
  bare = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  bare?: boolean;
}) {
  return (
    <button
      type={type}
      className={cn(
        "focus-ring inline-grid size-10 shrink-0 cursor-pointer place-items-center p-0 text-[var(--muted)] shadow-none transition-[background-color,border-color,color,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
        bare
          ? "border-0 bg-transparent hover:text-[var(--primary)]"
          : "rounded-xl border bg-[var(--surface)] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--primary)_32%,var(--border))] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}
