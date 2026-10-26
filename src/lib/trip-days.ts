import type { DayNormal } from "./open-meteo";

/**
 * The calendar dates a trip actually covers, each paired with what that date is
 * typically like.
 *
 * Dates are built from the `YYYY-MM-DD` strings with an explicit `T00:00:00`,
 * the same way the rest of the app does it. `new Date("2026-12-10")` parses as
 * UTC midnight, which in any negative offset is the 9th locally — so a trip
 * starting on the 10th would render a cell labelled 9. Appending the time
 * forces local interpretation and the label matches the trip.
 */

export type TripDay = { date: Date; normal: DayNormal };

/** Months a trip touches, as 1-indexed numbers for the climate API. */
export function monthsForApi(start: string, end: string): number[] {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return [];

  const out: number[] = [];
  const cursor = new Date(a.getFullYear(), a.getMonth(), 1);
  const last = new Date(b.getFullYear(), b.getMonth(), 1);
  while (cursor <= last) {
    out.push(cursor.getMonth() + 1);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/**
 * Walk the trip day by day, looking each date up in whichever month's normals
 * cover it.
 *
 * `byMonth` is keyed 1–12. A trip spanning a boundary needs both months
 * fetched; a date whose month is missing is simply skipped rather than faked,
 * so a half-loaded strip shows fewer cells instead of wrong ones.
 */
export function tripDays(
  start: string,
  end: string,
  byMonth: Map<number, DayNormal[]>,
): TripDay[] {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return [];

  const out: TripDay[] = [];
  const cursor = new Date(a);

  /* Guard against a pathological range rather than trusting the dates: the
     form validates end >= start, but a hand-edited row in the table editor
     doesn't go through the form. 400 days is far past any packing list. */
  let guard = 0;
  while (cursor <= b && guard++ < 400) {
    const month = cursor.getMonth() + 1;
    const normal = byMonth.get(month)?.find((d) => d.day === cursor.getDate());
    if (normal) out.push({ date: new Date(cursor), normal });
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}
