export type User = {
  id: string;
  name: string;
  score: number;
  matchesPredicted: number;
  avatar: string;
};

export type Player = {
  name: string;
  img: string;
  bio: string;
  role?: 'player' | 'coach';
  stats?: {
    label: string;
    value: string;
  }[];
};

export type TeamInfo = {
  id: string;
  name: string;
  flag: string;
  badgeUrl?: string;
  rank: number;
  group?: string;
  confederation?: string;
  continent?: string;
  introBench: string;
  introBn: string;
  history: string;
  historyBn: string;
  qualification?: string;
  teamPhoto?: string;
  players: Player[];
};

export type MatchData = {
  id: string;
  teamA: string;
  teamB: string;
  teamAName?: string;
  teamBName?: string;
  time: string;
  status: 'upcoming' | 'completed' | 'live';
  group: string;
  round?: string;
  scoreA: number | null;
  scoreB: number | null;
  winner?: string | null;
  venue?: string;
  preMatchAnalysis: string | null;
  postMatchAnalysis: string | null;
};

export type GroupStanding = {
  teamId: string;
  teamName: string;
  group: string;
  mp: number;
  gf: number;
  gd: string;
  pts: number;
  rank: number;
  badgeUrl?: string;
};

export type GroupInfo = {
  name: string;
  teams: TeamInfo[];
};
