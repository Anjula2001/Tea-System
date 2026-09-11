import type { DateRange, SellingPeriod } from './types';

/**
 * Choosing a stretch of auctions.
 *
 * Every screen that asks "over which period?" needs the same two things: a
 * date that is really a date, and a row of shortcut buttons. Both used to be
 * copied into each screen, and the copies had drifted.
 */

/** A calendar-valid YYYY-MM-DD, so 2026-02-31 is rejected rather than shifted. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The span every auction on file falls inside, or an open range when there are none. */
export function auctionBounds(periods: readonly SellingPeriod[]): DateRange {
  const dates = periods.map((p) => p.auctionDate).sort();
  return dates.length > 0
    ? { from: dates[0]!, to: dates.at(-1)! }
    : { from: '1970-01-01', to: '9999-12-31' };
}

export interface RangePreset {
  label: string;
  value: DateRange;
}

/**
 * "All auctions", "Last 3", "Last 6"… minus the ones that would be duplicates.
 *
 * With six auctions on file, "Last 6" and "Last 12" both mean the same span as
 * "All auctions". Offering all three lit three buttons for one selection, which
 * read as three separate filters being active. A preset whose range another
 * preset already covers is not a narrower choice — it is the same choice under
 * a misleading name, so it is dropped rather than shown.
 *
 * "All auctions" is listed first and therefore always the survivor: when the
 * whole history is selected, that is what it should say.
 */
export function rangePresets(
  periods: readonly SellingPeriod[],
  options: { counts?: readonly number[]; extra?: readonly (RangePreset | null)[] } = {},
): RangePreset[] {
  const { counts = [3, 6, 12], extra = [] } = options;
  const bounds = auctionBounds(periods);
  const dates = periods.map((p) => p.auctionDate).sort();

  const candidates: (RangePreset | null)[] = [
    { label: 'All auctions', value: bounds },
    ...counts.map((count) => {
      const slice = dates.slice(-count);
      return slice.length > 0
        ? { label: `Last ${count}`, value: { from: slice[0]!, to: dates.at(-1)! } }
        : null;
    }),
    ...extra,
  ];

  const seen = new Set<string>();
  return candidates.filter((preset): preset is RangePreset => {
    if (!preset) return false;
    const key = `${preset.value.from}|${preset.value.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
