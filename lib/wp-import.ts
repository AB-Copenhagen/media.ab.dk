// WordPress REST API importer for AB match results
// Source: https://ab.dk/wp-json/wp/v2/match

const WP_API = 'https://ab.dk/wp-json/wp/v2/match';
const AB_NAMES = ['AB', 'Akademisk Boldklub'];

export interface WpMatch {
  id: number;
  date: string;          // ISO datetime (post publish date ≈ match date)
  title: { rendered: string };
  slug: string;
  link: string;
}

export interface ParsedMatch {
  wpId: number;
  title: string;
  date: string;          // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;       // true = AB is home team
  opponent: string;
  link: string;
}

function parseTitle(raw: string): { homeTeam: string; awayTeam: string } | null {
  // Titles are "Home vs Away" — strip any HTML entities
  const title = raw.replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim();
  const parts  = title.split(/\s+vs\.?\s+/i);
  if (parts.length !== 2) return null;
  return { homeTeam: parts[0].trim(), awayTeam: parts[1].trim() };
}

function isAB(name: string): boolean {
  return AB_NAMES.some((n) => name.toLowerCase().includes(n.toLowerCase()));
}

export async function fetchWpMatches(page = 1, perPage = 100): Promise<WpMatch[]> {
  const url = `${WP_API}?per_page=${perPage}&page=${page}&orderby=date&order=asc&_fields=id,date,title,slug,link`;
  const res  = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`WP API error ${res.status}`);
  return res.json() as Promise<WpMatch[]>;
}

export async function fetchAllWpMatches(): Promise<WpMatch[]> {
  // First page also tells us total pages via X-WP-TotalPages header
  const url  = `${WP_API}?per_page=100&page=1&orderby=date&order=asc&_fields=id,date,title,slug,link`;
  const res  = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`WP API error ${res.status}`);

  const first: WpMatch[] = await res.json();
  const totalPages = parseInt(res.headers.get('X-WP-TotalPages') ?? '1', 10);

  if (totalPages <= 1) return first;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => fetchWpMatches(i + 2)),
  );
  return [...first, ...rest.flat()];
}

export function parseMatches(raw: WpMatch[]): ParsedMatch[] {
  return raw
    .map((m) => {
      const teams = parseTitle(m.title.rendered);
      if (!teams) return null;

      const { homeTeam, awayTeam } = teams;
      const abIsHome = isAB(homeTeam);
      const abIsAway = isAB(awayTeam);
      if (!abIsHome && !abIsAway) return null; // not an AB match

      const opponent = abIsHome ? awayTeam : homeTeam;
      const date     = m.date.split('T')[0]; // YYYY-MM-DD

      return {
        wpId:     m.id,
        title:    m.title.rendered.replace(/&amp;/g, '&'),
        date,
        homeTeam,
        awayTeam,
        isHome:   abIsHome,
        opponent,
        link:     m.link,
      } satisfies ParsedMatch;
    })
    .filter((m): m is ParsedMatch => m !== null);
}
