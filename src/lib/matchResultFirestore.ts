import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  resolveWinnerFromScores,
  WORLDCUP_MATCHES_COLLECTION,
} from './worldcupMatchTransform';

export async function updateMatchResultInFirestore(
  matchId: string,
  team1Name: string,
  team2Name: string,
  team1Score: number,
  team2Score: number
): Promise<void> {
  const winner = resolveWinnerFromScores(team1Name, team2Name, team1Score, team2Score);

  await updateDoc(doc(db, WORLDCUP_MATCHES_COLLECTION, matchId), {
    team1Score,
    team2Score,
    winner,
  });

  await fetch('/api/match/score-predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId }),
  });
}
