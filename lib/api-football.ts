// api-football.com (v3.football.api-sports.io) importer
// AB team ID: 2060  |  leagues: 122 = 2. Division, 121 = DBU Pokalen

const API_BASE  = 'https://v3.football.api-sports.io';
const TEAM_ID   = 2060;
const LEAGUES   = [122, 121]; // 2. Division + DBU Pokalen
const AB_NAMES  = ['ab copenhagen', 'akademisk boldklub', 'ab'];

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;        // ISO datetime
    venue: { name: string | null; city: string | null };
    status: { short: string; long: string };
  };
  league: { id: number; name: string; round: string };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

export interface ParsedMatch {
  fixtureId: number;
  date: string;           // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
  opponent: string;
  homeScore: number | null;
  awayScore: number | null;
  result: string | null;  // "3-0"
  abResult: 'W' | 'D' | 'L' | null;
  competition: string;
  round: string;
  venue: string | null;
  status: string;
  name: string;           // "AB 3-0 Thisted FC" or "AB vs Thisted FC"
}

function isAB(name: string): boolean {
  const lower = name.toLowerCase();
  return AB_NAMES.some((n) => lower.includes(n));
}

function getApiKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error('Missing API_FOOTBALL_KEY env var');
  return key;
}

async function fetchFixtures(season: number, leagueId: number): Promise<ApiFixture[]> {
  const key = getApiKey();
  const url = `${API_BASE}/fixtures?team=${TEAM_ID}&season=${season}&league=${leagueId}`;
  const res  = await fetch(url, { headers: { 'x-apisports-key': key } });
  if (!res.ok) throw new Error(`API-Football error ${res.status}`);

  const data = await res.json() as {
    errors: Record<string, string>;
    response: ApiFixture[];
  };

  if (data.errors && Object.keys(data.errors).length > 0) {
    const msg = Object.values(data.errors)[0];
    throw new Error(`API-Football: ${msg}`);
  }

  return data.response;
}

export async function fetchSeasonFixtures(season: number): Promise<ParsedMatch[]> {
  const allFixtures = (
    await Promise.all(LEAGUES.map((id) => fetchFixtures(season, id)))
  ).flat();

  // Sort chronologically
  allFixtures.sort(
    (a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime(),
  );

  return allFixtures.map((f) => {
    const isHome    = isAB(f.teams.home.name);
    const opponent  = isHome ? f.teams.away.name : f.teams.home.name;
    const date      = f.fixture.date.split('T')[0];
    const finished  = ['FT', 'AET', 'PEN'].includes(f.fixture.status.short);
    const hs        = f.goals.home;
    const as_       = f.goals.away;

    const result   = finished && hs !== null && as_ !== null ? `${hs}-${as_}` : null;
    const abGoals  = finished ? (isHome ? hs : as_) : null;
    const oppGoals = finished ? (isHome ? as_ : hs) : null;
    const abResult: ParsedMatch['abResult'] =
      abGoals === null || oppGoals === null ? null
      : abGoals > oppGoals ? 'W'
      : abGoals < oppGoals ? 'L'
      : 'D';

    const scoreStr = result ? (isHome ? `${hs}-${as_}` : `${as_}-${hs}`) : null;
    const name     = scoreStr ? `AB ${scoreStr} ${opponent}` : `AB vs ${opponent}`;

    const venue = [f.fixture.venue.name, f.fixture.venue.city]
      .filter(Boolean).join(', ') || null;

    return {
      fixtureId:   f.fixture.id,
      date,
      homeTeam:    f.teams.home.name,
      awayTeam:    f.teams.away.name,
      isHome,
      opponent,
      homeScore:   hs,
      awayScore:   as_,
      result,
      abResult,
      competition: f.league.name,
      round:       f.league.round,
      venue,
      status:      f.fixture.status.short,
      name,
    } satisfies ParsedMatch;
  });
}
