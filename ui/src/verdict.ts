// How a verdict looks, the same on the page, the dashboard card and the
// printer's screens.
import type { Watch } from './guard';

export type Verdict = Watch['verdict'];

/** The badge a verdict is drawn as. */
export const verdictBadge = {
  warming_up: 'secondary',
  ok: 'success',
  warning: 'warning',
  failing: 'destructive',
} as const satisfies Record<Verdict, string>;

/** The colour of the trend bar under a verdict. */
export const verdictBar = {
  warming_up: 'bg-success',
  ok: 'bg-success',
  warning: 'bg-warning',
  failing: 'bg-destructive',
} as const satisfies Record<Verdict, string>;

/** An ISO time as the person's locale writes it, or a dash for none. */
export const when = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) || at.getFullYear() < 2000
    ? '–'
    : at.toLocaleString();
};
