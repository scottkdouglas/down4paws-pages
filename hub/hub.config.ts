import type { HubConfig } from '@/lib/types';

const hub = {
  client: { name: 'Down 4 Paws', shortName: 'Down 4 Paws', slug: 'down4paws', ownerName: 'Pam', ownerInitials: 'PB', timezone: 'America/New_York' },
  agency: { name: 'SKD Media', initials: 'SD' },
  brand: { logo: '/logo.png', primary: '#613393', secondary: '#F36E21' },
  sprint: { number: 1, total: 3, start: '2026-09-15', lengthDays: 90 },
  nextUpdateDay: 'Monday',
  modules: ['board', 'numbers', 'scoreboard', 'updates', 'decisions', 'deliverables', 'recordings'],
  serviceTags: [
    { id: 'wp-site', label: 'Website' },
    { id: 'blog', label: 'Blog' },
    { id: 'newsletter', label: 'Newsletter' },
    { id: 'landing', label: 'Landing pages' },
    { id: 'local-seo', label: 'Local SEO' },
    { id: 'sales-tracking', label: 'Sales tracking' },
    { id: 'workshops', label: 'Workshops' },
    { id: 'site-v2', label: 'Site v2' },
  ],
  links: [
    { label: 'down4paws.com', href: 'https://down4paws.com', group: 'live' },
    { label: 'Workshop page', href: 'https://workshop.down4paws.com', group: 'live' },
    { label: 'Loose leash guide', href: 'https://looseleash.down4paws.com', group: 'live' },
    { label: 'Site v2 preview', href: 'https://preview-site-jet.vercel.app', group: 'live' },
  ],
} satisfies HubConfig;

export default hub;
