/**
 * Shared shape contract for the client hub.
 *
 * Both the security/data layer and the UI layer read these types, so field
 * names here are the single source of truth. Changing one means changing the
 * content files and the components that read them.
 */

/** Every feature page the hub can show. One deploy may enable any subset. */
export type ModuleId =
  | 'board'
  | 'numbers'
  | 'scoreboard'
  | 'updates'
  | 'decisions'
  | 'deliverables'
  | 'recordings';

export interface HubConfig {
  client: {
    name: string;
    shortName: string;
    /** Also signed into the session cookie, so it must match HUB_SLUG in Vercel. */
    slug: string;
    ownerName: string;
    ownerInitials: string;
    /** IANA zone, e.g. "America/Toronto". All dates render in this zone. */
    timezone: string;
  };
  agency: {
    name: string;
    initials: string;
  };
  brand: {
    logo: string;
    logoOnDark?: string;
    /** Backdrop behind the logo, for logos drawn for dark sites. Hex color. */
    logoBackground?: string;
    primary: string;
    secondary: string;
  };
  sprint: {
    number: number;
    total: number;
    /** YYYY-MM-DD, the first day of the sprint. */
    start: string;
    lengthDays: number;
    label?: string;
  };
  /** Weekday name the client should expect the next update on, e.g. "Monday". */
  nextUpdateDay: string;
  modules: ModuleId[];
  serviceTags: { id: string; label: string }[];
  links: { label: string; href: string; group?: 'live' | 'tools' | 'docs' }[];
}

/** One entry of hub.links. */
export type HubLink = HubConfig['links'][number];
