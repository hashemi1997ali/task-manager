import Image from "next/image";

import type { User } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

export const avatarFrameClassName = (className?: string): string =>
  cn(
    "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--foreground)_8%,var(--border))] bg-[var(--primary-soft)] text-sm font-black text-[var(--primary-dark)]",
    className,
  );

export function UserAvatar({
  user,
  className,
  imageSizes = "48px",
  imageUrl,
}: {
  user: Pick<User, "firstName" | "lastName" | "profileImage"> | null | undefined;
  className?: string;
  imageSizes?: string;
  imageUrl?: string | null;
}) {
  const label = user ? `${user.firstName} ${user.lastName}`.trim() : "User";
  const resolvedImageUrl = imageUrl === undefined ? user?.profileImage?.url : imageUrl;

  return (
    <span
      className={avatarFrameClassName(className)}
      aria-label={`${label} profile image`}
    >
      {resolvedImageUrl ? (
        <Image
          src={resolvedImageUrl}
          alt=""
          fill
          sizes={imageSizes}
          unoptimized={resolvedImageUrl.startsWith("blob:")}
          className="object-cover"
        />
      ) : (
        initials(user?.firstName, user?.lastName)
      )}
    </span>
  );
}
