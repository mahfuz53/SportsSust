import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  isMatchWinnerFinalized,
  isPredictionCorrect,
  resolveActualChoiceFromMatch,
} from './predictionUtils';
import {
  LEADERBOARD_COLLECTION,
  PREDICTION_POINTS_CORRECT,
  PREDICTION_POINTS_WRONG,
  PREDICTIONS_SUBCOLLECTION,
  type MatchPrediction,
} from './predictionTypes';
import {
  WORLDCUP_MATCHES_COLLECTION,
  type WorldcupFirestoreMatch,
} from './worldcupMatchTransform';

export async function scorePredictionsForMatchInFirestore(matchId: string): Promise<{
  scored: number;
  skipped: number;
}> {
  const matchRef = doc(db, WORLDCUP_MATCHES_COLLECTION, matchId);
  const matchSnap = await getDoc(matchRef);

  if (!matchSnap.exists()) {
    throw new Error(`Match ${matchId} not found.`);
  }

  const match = matchSnap.data() as WorldcupFirestoreMatch;
  if (!isMatchWinnerFinalized(match.winner)) {
    return { scored: 0, skipped: 0 };
  }

  // Map the match winner (team name or "draw") to a prediction choice for comparison.
  const actual = resolveActualChoiceFromMatch({
    team1: match.team1,
    team2: match.team2,
    team1Score: match.team1Score,
    team2Score: match.team2Score,
    winner: match.winner,
  });

  if (!actual) {
    return { scored: 0, skipped: 0 };
  }

  const predictionsSnap = await getDocs(
    collection(db, WORLDCUP_MATCHES_COLLECTION, matchId, PREDICTIONS_SUBCOLLECTION)
  );

  let scored = 0;
  let skipped = 0;

  for (const predDoc of predictionsSnap.docs) {
    const prediction = predDoc.data() as MatchPrediction;
    if (prediction.processed) {
      skipped += 1;
      continue;
    }

    const points = isPredictionCorrect(prediction.choice, actual)
      ? PREDICTION_POINTS_CORRECT
      : PREDICTION_POINTS_WRONG;

    const didScore = await scorePredictionInTransaction(prediction.userId, predDoc.ref, points, {
      displayName: prediction.displayName,
      email: prediction.email,
      photoURL: prediction.photoURL,
    });

    if (didScore) {
      scored += 1;
    } else {
      skipped += 1;
    }
  }

  return { scored, skipped };
}

async function scorePredictionInTransaction(
  userId: string,
  predictionRef: ReturnType<typeof doc>,
  points: number,
  profile: { displayName: string; email: string; photoURL: string }
): Promise<boolean> {
  const leaderboardRef = doc(db, LEADERBOARD_COLLECTION, userId);
  const now = Date.now();

  return runTransaction(db, async (tx) => {
    const predSnap = await tx.get(predictionRef);
    const lbSnap = await tx.get(leaderboardRef);

    if (!predSnap.exists()) return false;

    const prediction = predSnap.data() as MatchPrediction;
    if (prediction.processed) return false;

    tx.update(predictionRef, {
      processed: true,
      pointsAwarded: points,
      updatedAt: now,
    });

    if (lbSnap.exists()) {
      const current = lbSnap.data();
      tx.update(leaderboardRef, {
        score: (current?.score ?? 0) + points,
        displayName: profile.displayName || current?.displayName || '',
        email: profile.email || current?.email || '',
        photoURL: profile.photoURL || current?.photoURL || '',
        updatedAt: now,
      });
    } else {
      tx.set(leaderboardRef, {
        userId,
        displayName: profile.displayName,
        email: profile.email,
        photoURL: profile.photoURL || '',
        score: points,
        matchesPredicted: 0,
        updatedAt: now,
      });
    }

    return true;
  });
}
