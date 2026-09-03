import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const getId = (item: { id?: string; _id?: string }): string =>
  item.id ?? item._id ?? "";

export const formatDate = (
  value: string | Date | null | undefined,
  locale = "en-US",
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...options,
  }).format(date);
};

export const formatDateTime = (
  value: string | Date | null | undefined,
  locale = "en-US",
): string => formatDate(value, locale, { dateStyle: "medium", timeStyle: "short" });

export const formatTime = (
  value: string | Date | null | undefined,
  locale = "en-US",
): string => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
};

export const formatNumber = (value: number, locale = "en-US"): string =>
  new Intl.NumberFormat(locale).format(value);

export const formatPercent = (value: number, locale = "en-US"): string =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);

export const toLocalDateTimeInput = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const initials = (firstName?: string, lastName?: string): string =>
  `${firstName?.trim().charAt(0) ?? ""}${lastName?.trim().charAt(0) ?? ""}` || "K";
