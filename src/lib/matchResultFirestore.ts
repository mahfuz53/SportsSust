import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WORLDCUP_MATCHES_COLLECTION } from './worldcupMatchTransform';

export async function updateMatchResultInFirestore(
  matchId: string,
  team1Score: number,
  team2Score: number,
  winner: string | null
): Promise<void> {
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
