import type { MatchData } from '../types';
import { isDrawWinner } from './worldcupMatchTransform';
import { computeMatchStatus } from './matchUtils';
import type { PredictionChoice } from './predictionTypes';

export type MatchResultForScoring = {
  team1: string;
  team2: string;
  team1Score: number | null;
  team2Score: number | null;
  winner: string | null;
};

export function isMatchWinnerFinalized(winner: string | null | undefined): boolean {
  return winner != null && winner.trim() !== '';
}

export function winnerToPredictionChoice(
  winner: string,
  team1: string,
  team2: string
): PredictionChoice | null {
  if (isDrawWinner(winner)) return 'draw';
  if (winner === team1) return 'team1';
  if (winner === team2) return 'team2';
  return null;
}

export function resolveActualChoiceFromMatch(match: MatchResultForScoring): PredictionChoice | null {
  if (isMatchWinnerFinalized(match.winner)) {
    return winnerToPredictionChoice(match.winner!, match.team1, match.team2);
  }

  if (match.team1Score !== null && match.team2Score !== null) {
    return getActualChoice(match.team1, match.team2, match.team1Score, match.team2Score);
  }

  return null;
}

export function didWinnerBecomeFinalized(
  previousWinner: string | null | undefined,
  currentWinner: string | null | undefined
): boolean {
  return !isMatchWinnerFinalized(previousWinner) && isMatchWinnerFinalized(currentWinner);
}

export function canSubmitPrediction(match: MatchData, now = Date.now()): boolean {
  if (computeMatchStatus(match, now) !== 'upcoming') return false;
  const kickoff = new Date(match.time).getTime();
  if (kickoff <= now) return false;
  if (kickoff - now < 30 * 60 * 1000) return false;
  return true;
}

export function getActualChoice(
  team1Name: string,
  team2Name: string,
  scoreA: number,
  scoreB: number
): PredictionChoice {
  if (scoreA > scoreB) return 'team1';
  if (scoreB > scoreA) return 'team2';
  return 'draw';
}

export function isPredictionCorrect(choice: PredictionChoice, actual: PredictionChoice): boolean {
  return choice === actual;
}

export function choiceLabel(
  choice: PredictionChoice,
  team1Name: string,
  team2Name: string
): string {
  if (choice === 'team1') return team1Name;
  if (choice === 'team2') return team2Name;
  return 'Draw';
}
