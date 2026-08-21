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
        "focus-ring inline-grid size-11 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--muted)] shadow-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        bare
          ? "rounded-none hover:bg-transparent hover:text-[var(--primary)]"
          : "rounded-full hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}
