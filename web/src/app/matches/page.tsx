'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Match } from '@/types';

function ScoreBadge({ match }: { match: Match }) {
  const hw = match.home_score > match.away_score;
  const aw = match.away_score > match.home_score;
  return (
    <div className="flex items-center gap-2 text-2xl font-bold">
      <span className={hw ? 'text-home' : 'text-muted'}>{match.home_score}</span>
      <span className="text-muted text-lg">–</span>
      <span className={aw ? 'text-away' : 'text-muted'}>{match.away_score}</span>
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.matches.list()
      .then(setMatches)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('この試合記録を削除しますか？')) return;
    await api.matches.destroy(id);
    setMatches(prev => prev.filter(m => m.id !== id));
  };

  if (loading) return <div className="text-muted">読み込み中...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">試合記録</h1>
        <Link
          href="/matches/new"
          className="bg-accent text-bg font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + 新しい試合
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-4xl mb-3">⚽</p>
          <p>試合記録がありません</p>
          <Link href="/matches/new" className="text-accent hover:underline mt-2 inline-block">
            最初の試合を記録する
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(m => (
            <div
              key={m.id}
              className="bg-card border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted mb-1">
                    {m.date && new Date(m.date).toLocaleDateString('ja-JP')}
                    {m.location && <span className="ml-2">📍 {m.location}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-home truncate">{m.home_team || 'ホーム'}</span>
                    <ScoreBadge match={m} />
                    <span className="font-semibold text-away truncate">{m.away_team || 'アウェイ'}</span>
                  </div>
                  {m.players.length > 0 && (
                    <div className="text-xs text-muted mt-1">{m.players.length}名出場</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/matches/${m.id}`}
                    className="text-sm text-muted hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors"
                  >
                    詳細
                  </Link>
                  <Link
                    href={`/matches/${m.id}/edit`}
                    className="text-sm text-accent hover:opacity-80 px-3 py-1.5 rounded-lg border border-accent/30 hover:border-accent/60 transition-colors"
                  >
                    編集
                  </Link>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-sm text-red-400 hover:opacity-80 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500/60 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
