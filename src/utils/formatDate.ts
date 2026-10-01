/**
 * formatDate.ts — Timestamp helpers for the messaging feature.
 *
 * Both functions use `new Date(isoString)` which correctly converts
 * UTC "Z"-suffixed strings (and explicit offsets) to the browser's
 * local timezone — no manual hour arithmetic needed.
 */

/**
 * Returns a short time string in the browser's locale, e.g. "14:32" or "2:32 PM".
 * Uses 24-hour format where the locale prefers it, 12-hour otherwise.
 */
export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a smart date label:
 *   - "Today"      — if the message is from today (local time)
 *   - "Yesterday"  — if from yesterday
 *   - "Sep 28"     — month + day, no year, if within the current year
 *   - "Sep 28, 2024" — month + day + year, if from a previous year
 */
export function formatMessageDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  // Normalise both to midnight local time for day comparison
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today   = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const diffDays = Math.round(
    (today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Smart inbox timestamp:
 * - If the message is from today → show only the time ("14:32")
 * - Otherwise → show the date label ("Yesterday", "Sep 28", …)
 */
export function formatInboxTimestamp(isoString: string): string {
  const dateLabel = formatMessageDate(isoString);
  if (dateLabel === 'Today') {
    return formatMessageTime(isoString);
  }
  return dateLabel;
}
