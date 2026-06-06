export type Position = 'GK' | 'CB' | 'SB' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'CF';

export interface Player {
  id: number;
  name: string;
  jersey_number: string | null;
  position: Position | null;
  photo_url: string | null;
  note: string | null;
}

export interface MatchPlayer {
  id: number;
  match_id: number;
  player_id: number;
  team: 'home' | 'away';
  rating: number | null;
  note: string | null;
  player: Player;
}

export interface Match {
  id: number;
  date: string;
  location: string | null;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  home_formation: string | null;
  away_formation: string | null;
  note: string | null;
  players: MatchPlayer[];
}

export interface MatchPlayerInput {
  player_id: number;
  rating: string;
  note: string;
}
