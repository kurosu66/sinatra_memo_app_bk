'use client';
import { useState } from 'react';
import type { Match, Player, MatchPlayerInput } from '@/types';

interface TeamSectionProps {
  label: string;
  colorClass: string;
  players: MatchPlayerInput[];
  addId: string;
  setAddId: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: keyof MatchPlayerInput, value: string) => void;
  availablePlayers: Player[];
  allPlayers: Player[];
}

function TeamSection({
  label, colorClass, players, addId, setAddId, onAdd, onRemove, onUpdate,
  availablePlayers, allPlayers,
}: TeamSectionProps) {
  const findPlayer = (id: number) => allPlayers.find(p => p.id === id);

  return (
    <div className="flex-1 min-w-0">
      <h3 className={`font-bold text-base mb-3 ${colorClass}`}>{label}</h3>
      <div className="space-y-2 mb-3">
        {players.map((mp, idx) => {
          const p = findPlayer(mp.player_id);
          if (!p) return null;
          return (
            <div key={idx} className="bg-bg border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">
                  {p.jersey_number && (
                    <span className="text-muted mr-1">#{p.jersey_number}</span>
                  )}
                  {p.name}
                  {p.position && (
                    <span className="ml-1.5 text-xs bg-white/10 text-muted px-1.5 py-0.5 rounded">
                      {p.position}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="text-red-400 hover:text-red-300 text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <div className="flex gap-2">
                <div className="w-24">
                  <div className="text-xs text-muted mb-1">評価</div>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={mp.rating}
                    onChange={e => onUpdate(idx, 'rating', e.target.value)}
                    placeholder="—"
                    className="w-full bg-bg2 border border-white/20 rounded px-2 py-1 text-sm text-center"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted mb-1">メモ</div>
                  <input
                    type="text"
                    value={mp.note}
                    onChange={e => onUpdate(idx, 'note', e.target.value)}
                    placeholder="コメント..."
                    className="w-full bg-bg2 border border-white/20 rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allPlayers.length === 0 ? (
        <p className="text-sm text-muted">先に選手を登録してください</p>
      ) : availablePlayers.length === 0 && players.length === allPlayers.length ? (
        <p className="text-xs text-muted">全選手追加済み</p>
      ) : availablePlayers.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={addId}
            onChange={e => setAddId(e.target.value)}
            className="flex-1 bg-bg2 border border-white/20 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">選手を選択...</option>
            {availablePlayers.map(p => (
              <option key={p.id} value={p.id}>
                {p.jersey_number ? `#${p.jersey_number} ` : ''}{p.name}
                {p.position ? ` (${p.position})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAdd}
            disabled={!addId}
            className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 transition-colors"
          >
            追加
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  initialData?: Match;
  allPlayers: Player[];
  onSubmit: (data: unknown) => Promise<void>;
  submitLabel: string;
}

export default function MatchForm({ initialData, allPlayers, onSubmit, submitLabel }: Props) {
  const toInput = (mp: Match['players'][number]): MatchPlayerInput => ({
    player_id: mp.player_id,
    rating: mp.rating != null ? String(mp.rating) : '',
    note: mp.note ?? '',
  });

  const [date, setDate] = useState(initialData?.date ?? '');
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [homeTeam, setHomeTeam] = useState(initialData?.home_team ?? '');
  const [awayTeam, setAwayTeam] = useState(initialData?.away_team ?? '');
  const [homeScore, setHomeScore] = useState(String(initialData?.home_score ?? 0));
  const [awayScore, setAwayScore] = useState(String(initialData?.away_score ?? 0));
  const [note, setNote] = useState(initialData?.note ?? '');

  const [homePlayers, setHomePlayers] = useState<MatchPlayerInput[]>(
    initialData?.players.filter(p => p.team === 'home').map(toInput) ?? []
  );
  const [awayPlayers, setAwayPlayers] = useState<MatchPlayerInput[]>(
    initialData?.players.filter(p => p.team === 'away').map(toInput) ?? []
  );

  const [homeAddId, setHomeAddId] = useState('');
  const [awayAddId, setAwayAddId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const usedIds = new Set([
    ...homePlayers.map(p => p.player_id),
    ...awayPlayers.map(p => p.player_id),
  ]);
  const availablePlayers = allPlayers.filter(p => !usedIds.has(p.id));

  const addHome = () => {
    if (!homeAddId) return;
    setHomePlayers(prev => [...prev, { player_id: Number(homeAddId), rating: '', note: '' }]);
    setHomeAddId('');
  };

  const addAway = () => {
    if (!awayAddId) return;
    setAwayPlayers(prev => [...prev, { player_id: Number(awayAddId), rating: '', note: '' }]);
    setAwayAddId('');
  };

  const removeHome = (idx: number) => setHomePlayers(prev => prev.filter((_, i) => i !== idx));
  const removeAway = (idx: number) => setAwayPlayers(prev => prev.filter((_, i) => i !== idx));

  const updateHome = (idx: number, field: keyof MatchPlayerInput, value: string) =>
    setHomePlayers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  const updateAway = (idx: number, field: keyof MatchPlayerInput, value: string) =>
    setAwayPlayers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        date, location,
        home_team: homeTeam, away_team: awayTeam,
        home_score: Number(homeScore), away_score: Number(awayScore),
        note,
        players: [
          ...homePlayers.map(p => ({ ...p, team: 'home', rating: p.rating !== '' ? p.rating : null })),
          ...awayPlayers.map(p => ({ ...p, team: 'away', rating: p.rating !== '' ? p.rating : null })),
        ],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-bg border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-accent/60';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Match info */}
      <div className="bg-card border border-white/10 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-accent text-sm uppercase tracking-wide">試合情報</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">場所</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="会場名" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">ホームチーム</label>
            <input type="text" value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="チーム名" className={`${inputCls} text-home`} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">アウェイチーム</label>
            <input type="text" value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="チーム名" className={`${inputCls} text-away`} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">スコア</label>
          <div className="flex items-center gap-3">
            <input
              type="number" min="0" value={homeScore}
              onChange={e => setHomeScore(e.target.value)}
              className="w-20 bg-bg border border-white/20 rounded-lg px-3 py-2 text-center text-home font-bold text-lg focus:outline-none focus:border-accent/60"
            />
            <span className="text-muted font-bold text-xl">–</span>
            <input
              type="number" min="0" value={awayScore}
              onChange={e => setAwayScore(e.target.value)}
              className="w-20 bg-bg border border-white/20 rounded-lg px-3 py-2 text-center text-away font-bold text-lg focus:outline-none focus:border-accent/60"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">メモ</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="試合のメモ..."
            className={inputCls}
          />
        </div>
      </div>

      {/* Players */}
      <div className="bg-card border border-white/10 rounded-xl p-5">
        <h2 className="font-bold text-accent text-sm uppercase tracking-wide mb-4">選手評価</h2>
        <div className="flex gap-5">
          <TeamSection
            label={homeTeam || 'ホーム'}
            colorClass="text-home"
            players={homePlayers}
            addId={homeAddId}
            setAddId={setHomeAddId}
            onAdd={addHome}
            onRemove={removeHome}
            onUpdate={updateHome}
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
          />
          <div className="w-px bg-white/10 self-stretch" />
          <TeamSection
            label={awayTeam || 'アウェイ'}
            colorClass="text-away"
            players={awayPlayers}
            addId={awayAddId}
            setAddId={setAwayAddId}
            onAdd={addAway}
            onRemove={removeAway}
            onUpdate={updateAway}
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent text-bg font-bold py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {loading ? '保存中...' : submitLabel}
      </button>
    </form>
  );
}
