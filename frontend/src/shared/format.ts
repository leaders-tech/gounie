/*
This file keeps small text formatting helpers for dates, karma amounts, and link hosts.
Edit this file when dates or numbers should be shown differently across pages.
Copy the helper style here when you add another small shared formatter.
*/

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function linkHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
