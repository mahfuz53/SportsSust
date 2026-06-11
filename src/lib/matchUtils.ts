import { format } from 'date-fns';
import type { MatchData, TeamInfo } from '../types';
import {
  applyMatchStatus,
  computeMatchStatus,
  getMatchEndMs,
  getMatchKickoffMs,
  MATCH_DURATION_MINUTES,
} from '../../matchStatus';

export {
  applyMatchStatus,
  computeMatchStatus,
  getMatchEndMs,
  getMatchKickoffMs,
  MATCH_DURATION_MINUTES,
};

export function hasMatchStarted(match: MatchData, now = Date.now()): boolean {
  return now >= getMatchKickoffMs(match);
}

export function hasMatchEnded(match: MatchData, now = Date.now()): boolean {
  return now >= getMatchEndMs(match);
}

/** Local calendar date as YYYY-MM-DD (avoids UTC split on ISO strings). */
export function getMatchLocalDateKey(isoTime: string): string {
  const d = new Date(isoTime);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMatchDateKey(match: MatchData): string {
  return getMatchLocalDateKey(match.time);
}

export function getTodayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isMatchToday(match: MatchData, now = new Date()): boolean {
  return getMatchDateKey(match) === getTodayDateKey(now);
}

/** Format a YYYY-MM-DD key for display using local calendar components. */
export function formatMatchDateHeader(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return format(new Date(y, m - 1, d), 'EEEE, MMMM d, yyyy');
}

export function isDateToday(dateKey: string, now = new Date()): boolean {
  return dateKey === getTodayDateKey(now);
}

export function formatGroupLabel(match: MatchData): string {
  const group = match.group ?? '';
  if (/^[A-L]$/.test(group)) return `Group ${group}`;
  return match.round ?? (group || 'TBD');
}

export function resolveTeam(
  teams: TeamInfo[],
  teamId?: string,
  fallbackName?: string
): TeamInfo {
  const id = teamId || fallbackName || 'TBD';
  const name = fallbackName || teamId || 'TBD';
  return (
    teams.find((t) => t.id === teamId) ??
    teams.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? {
      id,
      name,
      flag: '🏳️',
      rank: 0,
      introBench: '',
      introBn: '',
      history: '',
      historyBn: '',
      players: [],
    }
  );
}

export function withComputedMatchStatuses(matches: MatchData[], now = Date.now()): MatchData[] {
  return matches.map((match) => applyMatchStatus(match, now));
}

export function canShowPredictCta(match: MatchData, now = Date.now()): boolean {
  return isMatchToday(match, new Date(now)) && computeMatchStatus(match, now) === 'upcoming';
}

/** Best match to highlight on load: live → next upcoming → last completed today. */
export function getTodayFocusMatch(matches: MatchData[], now = Date.now()): MatchData | null {
  const todaysMatches = matches
    .filter((match) => isMatchToday(match, new Date(now)))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (todaysMatches.length === 0) return null;

  const live = todaysMatches.find((match) => computeMatchStatus(match, now) === 'live');
  if (live) return live;

  const upcoming = todaysMatches.find((match) => computeMatchStatus(match, now) === 'upcoming');
  if (upcoming) return upcoming;

  return todaysMatches[todaysMatches.length - 1];
}

export type MatchStatusInfo = {
  label: string;
  score: string;
  tone: 'live' | 'completed';
};

export function getMatchStatusInfo(match: MatchData, now = Date.now()): MatchStatusInfo | null {
  const status = computeMatchStatus(match, now);
  const score = `${match.scoreA ?? 0} - ${match.scoreB ?? 0}`;

  if (status === 'upcoming') {
    return null;
  }
  if (status === 'live') {
    return { label: 'Live', score, tone: 'live' };
  }
  return { label: 'Full Time', score, tone: 'completed' };
}
