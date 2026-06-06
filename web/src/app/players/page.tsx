'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Player } from '@/types';

const POSITION_ORDER = ['GK', 'CB', 'SB', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.players.list()
      .then(setPlayers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('この選手を削除しますか？')) return;
    await api.players.destroy(id);
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const sorted = [...players].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.position ?? '');
    const bi = POSITION_ORDER.indexOf(b.position ?? '');
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name, 'ja');
  });

  if (loading) return <div className="text-muted">読み込み中...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">選手一覧</h1>
        <Link
          href="/players/new"
          className="bg-accent text-bg font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + 選手を登録
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-4xl mb-3">👤</p>
          <p>選手が登録されていません</p>
          <Link href="/players/new" className="text-accent hover:underline mt-2 inline-block">
            最初の選手を登録する
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-4 px-4 py-3 ${i < sorted.length - 1 ? 'border-b border-white/5' : ''}`}
            >
              <div className="w-10 text-right text-muted font-mono text-sm shrink-0">
                {p.jersey_number ? `#${p.jersey_number}` : '—'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{p.name}</div>
                {p.note && <div className="text-xs text-muted truncate">{p.note}</div>}
              </div>
              {p.position && (
                <span className="text-xs bg-white/10 text-muted px-2 py-1 rounded shrink-0">
                  {p.position}
                </span>
              )}
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/players/${p.id}/edit`}
                  className="text-xs text-accent hover:opacity-80 px-2.5 py-1.5 rounded border border-accent/30 hover:border-accent/60 transition-colors"
                >
                  編集
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-400 hover:opacity-80 px-2.5 py-1.5 rounded border border-red-500/30 hover:border-red-500/60 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
