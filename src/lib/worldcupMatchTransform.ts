import { computeMatchStatus } from '../../matchStatus';
import type { MatchData } from '../types';

export const WORLDCUP_MATCHES_COLLECTION = 'worldcup_matches';

export type WorldcupFirestoreMatch = {
  matchId: string;
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  team1Score: number | null;
  team2Score: number | null;
  winner: string | null;
  group?: string;
  ground?: string;
};

export function parseMatchDateTime(date: string, time: string): string {
  const utcMatch = time.match(/(\d{1,2}):(\d{2})\s+UTC([+-]?\d+)/i);
  if (utcMatch) {
    const hh = utcMatch[1].padStart(2, '0');
    const mm = utcMatch[2];
    let offset = utcMatch[3];
    if (!offset.startsWith('+') && !offset.startsWith('-')) offset = `+${offset}`;
    const sign = offset.startsWith('-') ? '-' : '+';
    const abs = String(Math.abs(parseInt(offset, 10))).padStart(2, '0');
    return `${date}T${hh}:${mm}:00${sign}${abs}:00`;
  }
  const timeMatch = time.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return `${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00.000Z`;
  }
  return `${date}T12:00:00.000Z`;
}

export function resolveWinnerFromScores(
  team1: string,
  team2: string,
  scoreA: number,
  scoreB: number
): string | null {
  if (scoreA > scoreB) return team1;
  if (scoreB > scoreA) return team2;
  return null;
}

export function fixtureToMatchData(
  fixture: WorldcupFirestoreMatch,
  resolveTeamId: (name: string) => string
): MatchData {
  const id = fixture.matchId;
  const teamA = resolveTeamId(fixture.team1);
  const teamB = resolveTeamId(fixture.team2);
  const group = fixture.group?.replace('Group ', '') ?? fixture.round;
  const kickoff = parseMatchDateTime(fixture.date, fixture.time);

  const scoreA = fixture.team1Score ?? null;
  const scoreB = fixture.team2Score ?? null;
  const winner =
    scoreA !== null && scoreB !== null
      ? resolveWinnerFromScores(fixture.team1, fixture.team2, scoreA, scoreB)
      : fixture.winner;

  const status = computeMatchStatus({ time: kickoff });

  return {
    id,
    teamA,
    teamB,
    teamAName: fixture.team1,
    teamBName: fixture.team2,
    time: kickoff,
    status,
    group,
    round: fixture.round,
    scoreA,
    scoreB,
    winner,
    venue: fixture.ground,
  };
}
