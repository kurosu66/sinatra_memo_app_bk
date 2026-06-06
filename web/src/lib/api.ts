import type { Player, Match } from '@/types';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...options,
  });
  if (res.status === 204) return null as T;
  const body = await res.json();
  if (!res.ok) throw new Error(body.errors?.join(', ') ?? res.statusText);
  return body as T;
}

export const api = {
  players: {
    list: () => req<Player[]>('/players'),
    get: (id: number) => req<Player>(`/players/${id}`),
    create: (data: Partial<Player>) =>
      req<Player>('/players', { method: 'POST', body: JSON.stringify({ player: data }) }),
    update: (id: number, data: Partial<Player>) =>
      req<Player>(`/players/${id}`, { method: 'PUT', body: JSON.stringify({ player: data }) }),
    destroy: (id: number) =>
      req<null>(`/players/${id}`, { method: 'DELETE' }),
  },
  matches: {
    list: () => req<Match[]>('/matches'),
    get: (id: number) => req<Match>(`/matches/${id}`),
    create: (data: unknown) =>
      req<Match>('/matches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: unknown) =>
      req<Match>(`/matches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    destroy: (id: number) =>
      req<null>(`/matches/${id}`, { method: 'DELETE' }),
  },
};
