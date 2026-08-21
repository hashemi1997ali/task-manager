"use client";

import type { HTMLAttributes } from "react";

import SpotlightCard from "@/components/SpotlightCard";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  spotlight?: boolean;
  spotlightColor?: string;
}

export function Card({
  className,
  spotlight = false,
  spotlightColor,
  ...props
}: CardProps) {
  const classes = cn(
    "rounded-[var(--container-radius)] border border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] shadow-[var(--shadow-panel)] transition-[background-color,border-color,box-shadow,transform] duration-300 hover:border-[color-mix(in_srgb,var(--primary)_24%,var(--border))]",
    className,
  );

  if (spotlight) {
    return (
      <SpotlightCard className={classes} spotlightColor={spotlightColor} {...props} />
    );
  }

  return <div className={classes} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-current/10 px-3 text-xs font-bold leading-none",
        className,
      )}
      {...props}
    />
  );
}
