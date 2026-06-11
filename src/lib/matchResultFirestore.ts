import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { didWinnerBecomeFinalized, isMatchWinnerFinalized } from './predictionUtils';
import { scorePredictionsForMatchInFirestore } from './predictionScoringFirestore';
import { WORLDCUP_MATCHES_COLLECTION } from './worldcupMatchTransform';

export async function updateMatchResultInFirestore(
  matchId: string,
  team1Score: number,
  team2Score: number,
  winner: string | null
): Promise<{ scored: number; skipped: number }> {
  const matchRef = doc(db, WORLDCUP_MATCHES_COLLECTION, matchId);
  const previousSnap = await getDoc(matchRef);
  const previousWinner = previousSnap.exists() ? (previousSnap.data()?.winner ?? null) : null;

  await updateDoc(matchRef, {
    team1Score,
    team2Score,
    winner,
  });

  if (!isMatchWinnerFinalized(winner)) {
    return { scored: 0, skipped: 0 };
  }

  if (didWinnerBecomeFinalized(previousWinner, winner) || previousWinner !== winner) {
    return scorePredictionsForMatchInFirestore(matchId);
  }

  return { scored: 0, skipped: 0 };
}
