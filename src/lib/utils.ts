import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function daysUntil(d: Date | string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export function currency(n: number | null | undefined) {
  if (n == null) return "—";
  // Locale is pinned rather than left to the runtime: en-IN gives the ₹ symbol
  // and Indian digit grouping (₹1,00,000 not ₹100,000), and keeps the server
  // and browser rendering identical regardless of either machine's locale.
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
