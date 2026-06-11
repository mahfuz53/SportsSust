import type { MatchData } from '../types';
import { computeMatchStatus } from './matchUtils';
import type { PredictionChoice } from './predictionTypes';

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
