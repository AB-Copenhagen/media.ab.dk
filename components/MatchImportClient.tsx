'use client';

import { useState } from 'react';

interface MatchRow {
  wpId: number;
  title: string;
  date: string;
  opponent: string;
  isHome: boolean;
  exists: boolean;
  link: string;
}

interface Season { id: string; name: string }

export default function MatchImportClient({ seasons }: { seasons: Season[] }) {
  const [matches,    setMatches]    = useState<MatchRow[] | null>(null);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [seasonId,   setSeasonId]   = useState(seasons[0]?.id ?? '');
  const [loading,    setLoading]    = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState<{ created: number; skipped: number } | null>(null);
  const [error,      setError]      = useState('');

  async function preview() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/import/matches');
      if (!res.ok) throw new Error(`Failed to fetch matches (${res.status})`);
      const data = await res.json() as { matches: MatchRow[] };
      const rows = data.matches.sort((a, b) => a.date.localeCompare(b.date));
      setMatches(rows);
      // Pre-select all that don't already exist
      setSelected(new Set(rows.filter((m) => !m.exists).map((m) => m.wpId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading matches');
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    if (!seasonId) { setError('Please select a season'); return; }
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/import/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wpIds: [...selected], seasonId }),
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      const data = await res.json() as { created: number; skipped: number };
      setResult(data);
      // Refresh preview to mark newly imported rows
      const r2 = await fetch('/api/import/matches');
      if (r2.ok) {
        const d2 = await r2.json() as { matches: MatchRow[] };
        setMatches(d2.matches.sort((a, b) => a.date.localeCompare(b.date)));
        setSelected(new Set());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function toggleAll(value: boolean) {
    if (!matches) return;
    setSelected(value ? new Set(matches.filter((m) => !m.exists).map((m) => m.wpId)) : new Set());
  }

  const newCount = matches?.filter((m) => !m.exists).length ?? 0;

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 16 }}>Import Matches from AB.dk</div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 200 }}>
          <label>Link to season</label>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="">— select season —</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" type="button" onClick={preview} disabled={loading || importing}>
          {loading ? <><span className="spinner" /> Loading…</> : 'Load matches from ab.dk'}
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      {result && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          Imported {result.created} match{result.created !== 1 ? 'es' : ''}.
          {result.skipped > 0 && ` ${result.skipped} already existed and were skipped.`}
        </div>
      )}

      {matches && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#6b7491' }}>
              {matches.length} matches found · {newCount} new
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" type="button" style={{ fontSize: 12 }} onClick={() => toggleAll(true)}>
                Select all new
              </button>
              <button className="btn-ghost" type="button" style={{ fontSize: 12 }} onClick={() => toggleAll(false)}>
                Deselect all
              </button>
            </div>
          </div>

          <div style={{ border: '1px solid #e8eaf4', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f7f8fc', borderBottom: '1px solid #e8eaf4' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: 32 }}></th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Match</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>H/A</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr
                    key={m.wpId}
                    style={{
                      borderBottom: i < matches.length - 1 ? '1px solid #f0f2f7' : undefined,
                      background: m.exists ? '#fafbff' : 'white',
                      opacity: m.exists ? 0.6 : 1,
                    }}
                  >
                    <td style={{ padding: '7px 12px' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(m.wpId)}
                        disabled={m.exists}
                        onChange={(e) => {
                          setSelected((s) => {
                            const next = new Set(s);
                            e.target.checked ? next.add(m.wpId) : next.delete(m.wpId);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td style={{ padding: '7px 12px', fontWeight: 500, color: '#12141f' }}>
                      <a href={m.link} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {m.title}
                      </a>
                    </td>
                    <td style={{ padding: '7px 12px', color: '#6b7491' }}>
                      {new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '7px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                        background: m.isHome ? '#e8f0fd' : '#f0f2f7',
                        color: m.isHome ? '#1a56c4' : '#555e80',
                        textTransform: 'uppercase',
                      }}>
                        {m.isHome ? 'Home' : 'Away'}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px' }}>
                      {m.exists
                        ? <span style={{ fontSize: 11, color: '#16a34a' }}>✓ Imported</span>
                        : <span style={{ fontSize: 11, color: '#8890b4' }}>New</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="btn-primary"
            type="button"
            onClick={importSelected}
            disabled={selected.size === 0 || importing || !seasonId}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {importing
              ? <><span className="spinner" /> Importing…</>
              : `Import ${selected.size} match${selected.size !== 1 ? 'es' : ''}`}
          </button>
        </>
      )}
    </div>
  );
}
