'use client';
import type { MatchPlayer } from '@/types';

const POSITION_ROW: Record<string, number> = {
  GK: 0,
  CB: 1, SB: 1,
  CM: 2,
  CAM: 3, LW: 3, RW: 3,
  ST: 4, CF: 4,
};

function ratingColor(r: number): string {
  if (r >= 8) return 'text-green-300';
  if (r >= 6.5) return 'text-blue-300';
  if (r >= 5) return 'text-yellow-300';
  return 'text-red-400';
}

function PlayerAvatar({ mp }: { mp: MatchPlayer }) {
  const p = mp.player;
  const parts = p.name.split(/[\s　・]/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : p.name.slice(0, 2).toUpperCase();

  const r = mp.rating != null ? Number(mp.rating) : null;
  const displayName = parts[parts.length - 1] || p.name;

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: '64px' }}>
      <div className="relative">
        {p.photo_url ? (
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/70 shadow-lg">
            <img
              src={p.photo_url}
              alt={p.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {initials}
          </div>
        )}
        {r != null && (
          <div className={`absolute -bottom-1 -right-1 text-[10px] font-bold px-1 py-0.5 rounded bg-black/70 ${ratingColor(r)}`}>
            {r.toFixed(1)}
          </div>
        )}
      </div>
      <div className="text-center leading-tight">
        {p.jersey_number && (
          <div className="text-white/60 text-[10px]">{p.jersey_number}</div>
        )}
        <div className="text-white text-[11px] font-medium truncate w-16 text-center">
          {displayName}
        </div>
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 300 460"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Field outline */}
      <rect x="8" y="8" width="284" height="444" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
      {/* Top penalty area */}
      <rect x="72" y="8" width="156" height="72" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      {/* Top goal area */}
      <rect x="112" y="8" width="76" height="28" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      {/* Top penalty spot */}
      <circle cx="150" cy="60" r="2.5" fill="rgba(255,255,255,0.25)" />
      {/* Top penalty arc */}
      <path d="M 112 80 A 40 40 0 0 0 188 80" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      {/* Center line */}
      <line x1="8" y1="230" x2="292" y2="230" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      {/* Center circle */}
      <circle cx="150" cy="230" r="48" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      <circle cx="150" cy="230" r="3" fill="rgba(255,255,255,0.25)" />
      {/* Bottom penalty area */}
      <rect x="72" y="380" width="156" height="72" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      {/* Bottom goal area */}
      <rect x="112" y="424" width="76" height="28" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      {/* Bottom penalty spot */}
      <circle cx="150" cy="400" r="2.5" fill="rgba(255,255,255,0.25)" />
      {/* Bottom penalty arc */}
      <path d="M 112 380 A 40 40 0 0 1 188 380" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
    </svg>
  );
}

interface Props {
  players: MatchPlayer[];
  formation?: string | null;
  teamName: string;
}

export default function FormationPitch({ players, formation, teamName }: Props) {
  const rowMap = new Map<number, MatchPlayer[]>();
  for (const mp of players) {
    const row = POSITION_ROW[mp.player.position ?? ''] ?? 2;
    if (!rowMap.has(row)) rowMap.set(row, []);
    rowMap.get(row)!.push(mp);
  }

  const rows = Array.from(rowMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, ps]) => ps);

  return (
    <div
      className="relative rounded-xl overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #2e7d32 0%, #388e3c 50%, #2e7d32 100%)', minHeight: '400px' }}
    >
      <PitchLines />

      {/* Header */}
      <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 z-10">
        <span className="font-bold text-white text-sm drop-shadow-md">{teamName}</span>
        {formation && (
          <span className="bg-black/40 text-white text-xs px-3 py-1 rounded-full font-bold border border-white/20">
            {formation}
          </span>
        )}
      </div>

      {/* Players grid */}
      <div
        className="relative z-10 flex flex-col justify-around items-stretch px-2"
        style={{ minHeight: '400px', paddingTop: '44px', paddingBottom: '12px' }}
      >
        {rows.length === 0 ? (
          <div className="flex items-center justify-center text-white/40 text-sm">
            選手なし
          </div>
        ) : (
          rows.map((rowPlayers, i) => (
            <div key={i} className="flex justify-around items-center py-1">
              {rowPlayers.map(mp => (
                <PlayerAvatar key={mp.id} mp={mp} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
