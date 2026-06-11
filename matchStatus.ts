import type { MatchData } from "./src/types";

/** Standard match duration in minutes (kickoff + 100 min = full time). */
export const MATCH_DURATION_MINUTES = 100;
export const MATCH_DURATION_MS = MATCH_DURATION_MINUTES * 60 * 1000;

export function getMatchKickoffMs(match: { time: string }): number {
  return new Date(match.time).getTime();
}

export function getMatchEndMs(match: { time: string }): number {
  return getMatchKickoffMs(match) + MATCH_DURATION_MS;
}

export function computeMatchStatus(
  match: { time: string },
  now = Date.now()
): MatchData["status"] {
  const kickoff = getMatchKickoffMs(match);
  const end = kickoff + MATCH_DURATION_MS;

  if (now < kickoff) return "upcoming";
  if (now < end) return "live";
  return "completed";
}

export function applyMatchStatus<T extends MatchData>(match: T, now = Date.now()): T {
  return { ...match, status: computeMatchStatus(match, now) };
}
