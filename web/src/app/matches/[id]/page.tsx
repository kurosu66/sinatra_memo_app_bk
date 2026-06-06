'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import FormationPitch from '@/components/FormationPitch';
import type { Match, MatchPlayer } from '@/types';

function ratingColor(r: number | null): string {
  if (r == null) return 'text-muted';
  if (r >= 8) return 'text-accent';
  if (r >= 6.5) return 'text-blue-400';
  if (r >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

function PlayerRow({ mp }: { mp: MatchPlayer }) {
  const r = mp.rating != null ? Number(mp.rating) : null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-6 text-right text-muted text-sm shrink-0">
        {mp.player.jersey_number ? `#${mp.player.jersey_number}` : ''}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{mp.player.name}</div>
        {mp.player.position && (
          <span className="text-xs bg-white/10 text-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">
            {mp.player.position}
          </span>
        )}
      </div>
      {r != null && (
        <div className={`font-bold text-lg tabular-nums shrink-0 ${ratingColor(r)}`}>
          {r.toFixed(1)}
        </div>
      )}
      {mp.note && (
        <div className="text-xs text-muted max-w-32 truncate hidden sm:block">{mp.note}</div>
      )}
    </div>
  );
}

function RatingSection({ title, colorClass, players }: { title: string; colorClass: string; players: MatchPlayer[] }) {
  const sorted = [...players].sort((a, b) => {
    const ra = a.rating != null ? Number(a.rating) : -1;
    const rb = b.rating != null ? Number(b.rating) : -1;
    return rb - ra;
  });
  const ratedPlayers = players.filter(p => p.rating != null);
  const avg = ratedPlayers.length > 0
    ? ratedPlayers.reduce((s, p) => s + Number(p.rating), 0) / ratedPlayers.length
    : null;

  return (
    <div className="flex-1 bg-card border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className={`font-bold ${colorClass}`}>{title}</h3>
        {avg != null && (
          <span className={`text-sm ${ratingColor(avg)}`}>平均 {avg.toFixed(1)}</span>
        )}
      </div>
      <div className="px-4">
        {sorted.length === 0 ? (
          <p className="text-muted text-sm py-4">選手なし</p>
        ) : (
          sorted.map(mp => <PlayerRow key={mp.id} mp={mp} />)
        )}
      </div>
    </div>
  );
}

type Tab = 'rating' | 'formation';

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('rating');

  useEffect(() => {
    api.matches.get(Number(id))
      .then(setMatch)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('この試合記録を削除しますか？')) return;
    await api.matches.destroy(Number(id));
    router.push('/matches');
  };

  if (loading) return <div className="text-muted">読み込み中...</div>;
  if (error || !match) return <div className="text-red-400">{error || '試合が見つかりません'}</div>;

  const home = match.players.filter(p => p.team === 'home');
  const away = match.players.filter(p => p.team === 'away');
  const hw = match.home_score > match.away_score;
  const aw = match.away_score > match.home_score;
  const hasFormation = home.length > 0 || away.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <Link href="/matches" className="text-muted hover:text-white text-sm">← 試合一覧</Link>
        <div className="flex gap-2">
          <Link
            href={`/matches/${id}/edit`}
            className="text-sm text-accent px-3 py-1.5 rounded-lg border border-accent/30 hover:border-accent/60 transition-colors"
          >
            編集
          </Link>
          <button
            onClick={handleDelete}
            className="text-sm text-red-400 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500/60 transition-colors"
          >
            削除
          </button>
        </div>
      </div>

      {/* Match header */}
      <div className="bg-card border border-white/10 rounded-xl p-6 mb-5">
        {(match.date || match.location) && (
          <div className="text-sm text-muted mb-3 text-center">
            {match.date && new Date(match.date).toLocaleDateString('ja-JP', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
            {match.location && <span className="ml-3">📍 {match.location}</span>}
          </div>
        )}
        <div className="flex items-center justify-center gap-6">
          <div className="flex-1 text-right">
            <div className={`text-xl font-bold ${hw ? 'text-home' : 'text-muted'}`}>
              {match.home_team || 'ホーム'}
            </div>
            {match.home_formation && (
              <div className="text-xs text-muted mt-0.5">{match.home_formation}</div>
            )}
          </div>
          <div className="flex items-center gap-3 text-4xl font-bold">
            <span className={hw ? 'text-home' : 'text-white/60'}>{match.home_score}</span>
            <span className="text-muted text-2xl">–</span>
            <span className={aw ? 'text-away' : 'text-white/60'}>{match.away_score}</span>
          </div>
          <div className="flex-1">
            <div className={`text-xl font-bold ${aw ? 'text-away' : 'text-muted'}`}>
              {match.away_team || 'アウェイ'}
            </div>
            {match.away_formation && (
              <div className="text-xs text-muted mt-0.5">{match.away_formation}</div>
            )}
          </div>
        </div>
        {match.note && (
          <p className="text-sm text-muted mt-4 text-center">{match.note}</p>
        )}
      </div>

      {/* Tab switcher */}
      {hasFormation && (
        <>
          <div className="flex gap-1 mb-4 bg-bg2 rounded-xl p-1 w-fit">
            <button
              onClick={() => setTab('rating')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'rating' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
              }`}
            >
              選手評価
            </button>
            <button
              onClick={() => setTab('formation')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'formation' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
              }`}
            >
              フォーメーション
            </button>
          </div>

          {tab === 'rating' && (
            <div className="flex gap-4 flex-col sm:flex-row">
              <RatingSection
                title={match.home_team || 'ホーム'}
                colorClass="text-home"
                players={home}
              />
              <RatingSection
                title={match.away_team || 'アウェイ'}
                colorClass="text-away"
                players={away}
              />
            </div>
          )}

          {tab === 'formation' && (
            <div className="flex gap-4 flex-col sm:flex-row">
              {home.length > 0 && (
                <div className="flex-1">
                  <FormationPitch
                    players={home}
                    formation={match.home_formation}
                    teamName={match.home_team || 'ホーム'}
                  />
                </div>
              )}
              {away.length > 0 && (
                <div className="flex-1">
                  <FormationPitch
                    players={away}
                    formation={match.away_formation}
                    teamName={match.away_team || 'アウェイ'}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
