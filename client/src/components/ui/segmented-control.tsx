import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  compact = false,
  iconOnly = false,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  ariaLabel: string;
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-full bg-[var(--surface-muted)] p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(({ value: option, label, icon: Icon }) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onValueChange(option)}
            aria-pressed={selected}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            className={cn(
              "focus-ring flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200",
              compact && "gap-1 px-1 text-[11px]",
              selected
                ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--foreground)_6%,transparent)]"
                : "text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] hover:text-[var(--foreground)]",
            )}
          >
            {Icon && (
              <Icon
                className={cn("size-4 shrink-0", compact && "size-3.5")}
                aria-hidden="true"
              />
            )}
            <span className={cn("truncate", iconOnly && "sr-only")}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
