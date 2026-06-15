import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';
import { fetchAllWpMatches, parseMatches } from '../../../../lib/wp-import';

// GET — preview: returns parsed matches + which ones already exist in DB
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const raw      = await fetchAllWpMatches();
  const parsed   = parseMatches(raw);

  // Check which are already imported (keyed by wpId stored in collection name or venue)
  const existing = await prisma.collection.findMany({
    where: { type: 'game' },
    select: { name: true, date: true },
  });
  const existingKeys = new Set(existing.map((c) => `${c.name}|${c.date?.toISOString().split('T')[0]}`));

  const withStatus = parsed.map((m) => ({
    ...m,
    exists: existingKeys.has(`${m.title}|${m.date}`),
  }));

  return NextResponse.json({ matches: withStatus, total: withStatus.length });
}

// POST — import: creates Collection records for selected matches
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const body = await request.json() as {
    wpIds: number[];
    seasonId: string;
  };

  if (!body.seasonId) return NextResponse.json({ message: 'seasonId required' }, { status: 400 });

  const raw    = await fetchAllWpMatches();
  const parsed = parseMatches(raw);
  const toImport = parsed.filter((m) => body.wpIds.includes(m.wpId));

  let created = 0;
  let skipped = 0;

  for (const m of toImport) {
    const existing = await prisma.collection.findFirst({
      where: { name: m.title, date: new Date(m.date) },
    });
    if (existing) { skipped++; continue; }

    await prisma.collection.create({
      data: {
        name:     m.title,
        type:     'game',
        date:     new Date(m.date),
        opponent: m.opponent,
        seasonId: body.seasonId,
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped });
}
