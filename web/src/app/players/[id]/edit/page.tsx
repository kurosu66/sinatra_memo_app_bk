'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Player, Position } from '@/types';

const POSITIONS: Position[] = ['GK', 'CB', 'SB', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];

export default function EditPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [name, setName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [position, setPosition] = useState<Position | ''>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.players.get(Number(id))
      .then(p => {
        setPlayer(p);
        setName(p.name);
        setJerseyNumber(p.jersey_number ?? '');
        setPosition((p.position as Position) ?? '');
        setNote(p.note ?? '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.players.update(Number(id), {
        name,
        jersey_number: jerseyNumber || null,
        position: position || null,
        note: note || null,
      });
      router.push('/players');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted">読み込み中...</div>;
  if (error && !player) return <div className="text-red-400">{error}</div>;

  const inputCls = 'w-full bg-bg border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-accent/60';

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/players" className="text-muted hover:text-white">← 選手一覧</Link>
        <h1 className="text-2xl font-bold">選手を編集</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-5">
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">選手名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="選手名"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">背番号</label>
            <input
              type="text"
              value={jerseyNumber}
              onChange={e => setJerseyNumber(e.target.value)}
              placeholder="例: 7"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">ポジション</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPosition(prev => prev === pos ? '' : pos)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    position === pos
                      ? 'bg-accent text-bg'
                      : 'bg-white/10 text-muted hover:bg-white/20'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">メモ</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="備考..."
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !name}
          className="w-full bg-accent text-bg font-bold py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? '保存中...' : '変更を保存'}
        </button>
      </form>
    </div>
  );
}
