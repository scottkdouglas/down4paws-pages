import type { ModuleId } from '@/lib/types';
import hub from '@hub';

import BoardPage from '@/components/modules/BoardPage.astro';
import NumbersPage from '@/components/modules/NumbersPage.astro';
import ScoreboardPage from '@/components/modules/ScoreboardPage.astro';
import UpdatesPage from '@/components/modules/UpdatesPage.astro';
import DecisionsPage from '@/components/modules/DecisionsPage.astro';
import DeliverablesPage from '@/components/modules/DeliverablesPage.astro';
import RecordingsPage from '@/components/modules/RecordingsPage.astro';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  href: string;
  order: number;
  page: typeof BoardPage;
}

/**
 * The full module catalogue. hub.modules decides which of these are built, so a
 * module left out of the config produces no route and no page in dist at all,
 * rather than an unlinked page a client could still guess the URL for.
 */
export const MODULES: Record<ModuleId, ModuleDef> = {
  board: { id: 'board', label: 'Sprint Board', href: '/board', order: 1, page: BoardPage },
  numbers: { id: 'numbers', label: 'Numbers', href: '/numbers', order: 2, page: NumbersPage },
  scoreboard: {
    id: 'scoreboard',
    label: 'Scoreboard',
    href: '/scoreboard',
    order: 3,
    page: ScoreboardPage,
  },
  updates: { id: 'updates', label: 'Updates', href: '/updates', order: 4, page: UpdatesPage },
  decisions: {
    id: 'decisions',
    label: 'Decisions',
    href: '/decisions',
    order: 5,
    page: DecisionsPage,
  },
  deliverables: {
    id: 'deliverables',
    label: 'Deliverables',
    href: '/deliverables',
    order: 6,
    page: DeliverablesPage,
  },
  recordings: {
    id: 'recordings',
    label: 'Recordings',
    href: '/recordings',
    order: 7,
    page: RecordingsPage,
  },
};

/** Modules this deploy has turned on, in nav order. */
export function enabledModules(): ModuleDef[] {
  return hub.modules
    .map((id) => MODULES[id])
    .filter((m): m is ModuleDef => Boolean(m))
    .sort((a, b) => a.order - b.order);
}
