'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import MatchForm from '@/components/MatchForm';
import type { Player } from '@/types';

export default function NewMatchPage() {
  const router = useRouter();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.players.list()
      .then(setAllPlayers)
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (data: unknown) => {
    const match = await api.matches.create(data);
    router.push(`/matches/${match.id}`);
  };

  if (loading) return <div className="text-muted">読み込み中...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/matches" className="text-muted hover:text-white">← 試合一覧</Link>
        <h1 className="text-2xl font-bold">新しい試合を記録</h1>
      </div>
      <MatchForm allPlayers={allPlayers} onSubmit={handleSubmit} submitLabel="試合を保存" />
    </div>
  );
}
