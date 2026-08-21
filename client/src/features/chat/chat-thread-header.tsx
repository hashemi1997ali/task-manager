import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ChatIconButton } from "@/features/chat/chat-icon-button";
import { cn } from "@/lib/utils";

export function ChatThreadHeader({
  avatar,
  title,
  titleHref,
  subtitle,
  meta,
  backLabel,
  onBack,
  hideBack = false,
}: {
  avatar: ReactNode;
  title: string;
  titleHref?: string;
  subtitle?: string;
  meta?: ReactNode;
  backLabel: string;
  onBack: () => void;
  hideBack?: boolean;
}) {
  return (
    <header className="chat-section-header flex h-16 shrink-0 items-center gap-2 px-2 sm:gap-3 sm:px-4">
      <ChatIconButton
        bare
        className={cn("xl:hidden", hideBack && "invisible")}
        aria-label={backLabel}
        title={backLabel}
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
      </ChatIconButton>
      {avatar}
      {titleHref ? (
        <Link
          href={titleHref}
          className="focus-ring flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-[var(--control-radius)] px-1 hover:text-[var(--primary)]"
        >
          <h2 className="truncate text-sm font-semibold" dir="auto">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]" dir="auto">
              {subtitle}
            </p>
          )}
        </Link>
      ) : (
        <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center px-1">
          <h2 className="truncate text-sm font-semibold" dir="auto">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]" dir="auto">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {meta && (
        <div className="ml-auto max-md:hidden shrink-0 items-center gap-1 md:flex xl:hidden">
          {meta}
        </div>
      )}
    </header>
  );
}
