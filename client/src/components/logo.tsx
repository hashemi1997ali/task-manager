import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({
  className,
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[0.9rem] ring-1 ring-inset",
        monochrome
          ? "bg-white text-black shadow-none ring-black/5"
          : "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--primary)_88%,white),var(--primary)_54%,color-mix(in_srgb,var(--highlight)_72%,var(--primary)))] text-white shadow-[0_10px_24px_var(--primary-glow)] ring-white/6",
        className,
      )}
      aria-hidden="true"
    >
      {!monochrome && (
        <span className="absolute inset-x-1.5 top-1 h-3 rounded-full bg-white/15 blur-[2px]" />
      )}
      <svg
        viewBox="0 0 24 24"
        className="relative size-6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.25 5.25v13.5M16.75 5.75 8 12l8.9 6.25"
          stroke="currentColor"
          strokeWidth="2.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function LogoWordmark({
  inverse = false,
  className,
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "overflow-hidden whitespace-nowrap text-[1.18rem] font-black tracking-[-0.055em]",
        inverse ? "text-white" : "text-[var(--foreground)]",
        className,
      )}
    >
      <span>Karino</span>
    </span>
  );
}

export function Logo({
  compact = false,
  inverse = false,
  stableLabel = false,
  monochrome = false,
  className,
  markClassName,
  wordmarkClassName,
}: {
  compact?: boolean;
  inverse?: boolean;
  stableLabel?: boolean;
  monochrome?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="Karino"
      className={cn(
        "focus-ring inline-flex items-center rounded-xl",
        stableLabel || !compact ? "gap-2.5" : "gap-0",
        className,
      )}
    >
      <LogoMark monochrome={monochrome} className={markClassName} />
      <LogoWordmark
        inverse={inverse}
        className={cn(
          "duration-150 motion-reduce:transition-none",
          stableLabel
            ? cn(
                "shrink-0 transition-opacity",
                compact
                  ? "pointer-events-none opacity-0"
                  : "opacity-100 delay-100 motion-reduce:delay-0",
              )
            : cn(
                "transition-[max-width,opacity]",
                compact
                  ? "max-w-0 opacity-0"
                  : "max-w-32 opacity-100 delay-100 motion-reduce:delay-0",
              ),
          wordmarkClassName,
        )}
      />
    </Link>
  );
}
