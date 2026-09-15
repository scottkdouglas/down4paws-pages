import type { HubConfig } from '@/lib/types';
import { daysBetween, todayIn } from '@/lib/dates';

export interface SprintProgress {
  /** 1-based day of the sprint, clamped to [1, total]. */
  day: number;
  total: number;
  /** Percent complete, 0 to 100, rounded. */
  pct: number;
  /** True once the sprint has run past its last day. */
  ended: boolean;
}

/**
 * Where the sprint stands today, read in the client's timezone.
 * Both the start date and today are pinned to midnight UTC before subtracting
 * so daylight saving cannot add or drop a day.
 */
export function sprintProgress(hub: HubConfig, tz: string): SprintProgress {
  const total = Math.max(hub.sprint.lengthDays, 1);
  const start = new Date(`${hub.sprint.start}T00:00:00Z`);
  const today = new Date(`${todayIn(tz)}T00:00:00Z`);

  const elapsed = daysBetween(start, today);
  const rawDay = elapsed + 1;
  const day = Math.min(Math.max(rawDay, 1), total);

  return {
    day,
    total,
    pct: Math.round((day / total) * 100),
    ended: rawDay > total,
  };
}

/** "Sprint 1 of 3 · Day 12 of 90" */
export function sprintLabel(hub: HubConfig, tz: string): string {
  const { day, total } = sprintProgress(hub, tz);
  return `Sprint ${hub.sprint.number} of ${hub.sprint.total} · Day ${day} of ${total}`;
}
