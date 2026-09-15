import { defineCollection } from 'astro:content';
// Astro 7 deprecates re-exporting `z` from 'astro:content' (removed in Astro 8).
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import hub from '@hub';

/**
 * Content collections for the hub. Every collection is file-backed so the
 * owner edits markdown or JSON and redeploys. Nothing is fetched at runtime.
 */

const serviceTagIds = hub.serviceTags.map((tag) => tag.id);

/**
 * Categories must resolve to a serviceTag declared in hub.config.ts, otherwise
 * the UI would render a filter chip with no label. Failing the build is better
 * than shipping a broken filter to a client.
 */
const serviceTag = z.string().refine((value) => serviceTagIds.includes(value), {
  message: `category must be one of: ${serviceTagIds.join(', ')}`,
});

const markdown = (name: string) =>
  glob({ base: `./src/content/${name}`, pattern: '**/*.md' });

const json = (name: string) =>
  glob({ base: `./src/content/${name}`, pattern: '**/*.json' });

const link = z.object({
  label: z.string(),
  href: z.string(),
});

/** Sprint board cards. Body is the detail shown when a card is expanded. */
const cards = defineCollection({
  loader: markdown('cards'),
  schema: z.object({
    title: z.string(),
    status: z.enum(['backlog', 'todo', 'doing', 'review', 'done']),
    category: serviceTag,
    owner: z.string(),
    due: z.coerce.date().optional(),
    doneAt: z.coerce.date().optional(),
    sprint: z.number(),
    nextSprint: z.boolean().default(false),
    links: z.array(link).optional(),
    order: z.number().default(0),
  }),
});

/** Decision log. Body is the why behind the call. */
const decisions = defineCollection({
  loader: markdown('decisions'),
  schema: z.object({
    date: z.coerce.date(),
    decision: z.string(),
    who: z.string(),
    tags: z.array(z.string()).optional(),
  }),
});

/** Shipped work, with the handover notes the client needs to actually use it. */
const deliverables = defineCollection({
  loader: markdown('deliverables'),
  schema: z.object({
    title: z.string(),
    delivered: z.coerce.date(),
    what: z.string(),
    howToUse: z.string(),
    whereItLives: z.url(),
    clientOwner: z.string(),
    category: serviceTag,
  }),
});

/** Call recordings. Exactly three bullets keeps the summary scannable. */
const recordings = defineCollection({
  loader: markdown('recordings'),
  schema: z.object({
    date: z.coerce.date(),
    call: z.string(),
    href: z.url(),
    bullets: z.array(z.string()).length(3),
    durationMin: z.number().optional(),
  }),
});

/** Open obligations in both directions, so nothing stalls silently. */
const scoreboard = defineCollection({
  loader: markdown('scoreboard'),
  schema: z.object({
    title: z.string(),
    direction: z.enum(['we-owe', 'you-owe']),
    source: z.string(),
    due: z.coerce.date().optional(),
    done: z.boolean().default(false),
    doneAt: z.coerce.date().optional(),
    href: z.url().optional(),
    category: z.string().optional(),
  }),
});

/** Weekly note. Body is the Friday write-up. */
const updates = defineCollection({
  loader: markdown('updates'),
  schema: z.object({
    weekOf: z.coerce.date(),
    shipped: z.array(z.string()),
    decided: z.array(z.string()),
    nextWeek: z.array(z.string()),
    needFromYou: z.array(z.string()),
  }),
});

/** Metrics, entered by hand so every number has a named source. */
const numbers = defineCollection({
  loader: json('numbers'),
  schema: z.object({
    id: z.string(),
    label: z.string(),
    value: z.string(),
    delta: z
      .object({
        value: z.string(),
        direction: z.enum(['up', 'down', 'flat']),
        period: z.string(),
      })
      .optional(),
    note: z.string().optional(),
    source: z.string(),
    asOf: z.coerce.date(),
    order: z.number(),
    group: z.string().optional(),
  }),
});

export const collections = {
  cards,
  decisions,
  deliverables,
  recordings,
  scoreboard,
  updates,
  numbers,
};
