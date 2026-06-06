'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import MatchForm from '@/components/MatchForm';
import type { Match, Player } from '@/types';

export default function EditMatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.matches.get(Number(id)), api.players.list()])
      .then(([m, players]) => {
        setMatch(m);
        setAllPlayers(players);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data: unknown) => {
    await api.matches.update(Number(id), data);
    router.push(`/matches/${id}`);
  };

  if (loading) return <div className="text-muted">読み込み中...</div>;
  if (error || !match) return <div className="text-red-400">{error || '試合が見つかりません'}</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/matches/${id}`} className="text-muted hover:text-white">← 試合詳細</Link>
        <h1 className="text-2xl font-bold">試合を編集</h1>
      </div>
      <MatchForm
        initialData={match}
        allPlayers={allPlayers}
        onSubmit={handleSubmit}
        submitLabel="変更を保存"
      />
    </div>
  );
}
