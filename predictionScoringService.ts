import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firestoreAdmin';
import { WORLDCUP_MATCHES_COLLECTION } from './src/lib/worldcupMatchTransform';
import {
  isMatchWinnerFinalized,
  isPredictionCorrect,
  resolveActualChoiceFromMatch,
} from './src/lib/predictionUtils';
import {
  LEADERBOARD_COLLECTION,
  PREDICTIONS_SUBCOLLECTION,
  PREDICTION_POINTS_CORRECT,
  PREDICTION_POINTS_WRONG,
  type MatchPrediction,
  type PredictionChoice,
} from './src/lib/predictionTypes';

function predictionDocRef(matchId: string, userId: string) {
  const db = getAdminFirestore();
  return db
    .collection(WORLDCUP_MATCHES_COLLECTION)
    .doc(matchId)
    .collection(PREDICTIONS_SUBCOLLECTION)
    .doc(userId);
}

export async function getUserPredictionAdmin(
  matchId: string,
  userId: string
): Promise<MatchPrediction | null> {
  const snap = await predictionDocRef(matchId, userId).get();
  return snap.exists ? (snap.data() as MatchPrediction) : null;
}

export async function saveUserPredictionAdmin(input: {
  matchId: string;
  userId: string;
  choice: PredictionChoice;
  displayName: string;
  email: string;
  photoURL: string;
}): Promise<MatchPrediction> {
  const ref = predictionDocRef(input.matchId, input.userId);
  const existing = await ref.get();

  if (existing.exists && (existing.data() as MatchPrediction).processed) {
    throw new Error('This prediction has already been scored and cannot be changed.');
  }

  const isUpdate = existing.exists;
  const now = Date.now();
  const data: MatchPrediction = {
    userId: input.userId,
    matchId: input.matchId,
    choice: input.choice,
    displayName: input.displayName,
    email: input.email,
    photoURL: input.photoURL || '',
    createdAt: isUpdate ? (existing.data() as MatchPrediction).createdAt : now,
    updatedAt: now,
    processed: false,
    pointsAwarded: null,
  };

  await ref.set(data);

  await registerPredictionOnLeaderboard({
    userId: input.userId,
    displayName: input.displayName,
    email: input.email,
    photoURL: input.photoURL,
    isNewPrediction: !isUpdate,
  });

  return data;
}

export async function scorePredictionsForMatch(matchId: string): Promise<{
  scored: number;
  skipped: number;
}> {
  const db = getAdminFirestore();
  const matchRef = db.collection(WORLDCUP_MATCHES_COLLECTION).doc(matchId);
  const matchSnap = await matchRef.get();

  if (!matchSnap.exists) {
    throw new Error(`Match ${matchId} not found.`);
  }

  const match = matchSnap.data()!;

  if (!isMatchWinnerFinalized(match.winner)) {
    return { scored: 0, skipped: 0 };
  }

  const actual = resolveActualChoiceFromMatch({
    team1: match.team1,
    team2: match.team2,
    team1Score: match.team1Score ?? null,
    team2Score: match.team2Score ?? null,
    winner: match.winner ?? null,
  });

  if (!actual) {
    return { scored: 0, skipped: 0 };
  }
  const predictionsSnap = await matchRef.collection(PREDICTIONS_SUBCOLLECTION).get();

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

    const didScore = await scorePredictionInTransaction(
      predDoc.ref,
      prediction,
      points
    );

    if (didScore) {
      scored += 1;
    } else {
      skipped += 1;
    }
  }

  if (scored > 0) {
    console.log(`[Predictions] Scored ${scored} predictions for ${matchId}`);
  }

  return { scored, skipped };
}

async function scorePredictionInTransaction(
  predictionRef: FirebaseFirestore.DocumentReference,
  prediction: MatchPrediction,
  points: number
): Promise<boolean> {
  const db = getAdminFirestore();
  const leaderboardRef = db.collection(LEADERBOARD_COLLECTION).doc(prediction.userId);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const predSnap = await tx.get(predictionRef);
    const lbSnap = await tx.get(leaderboardRef);

    if (!predSnap.exists) return false;

    const currentPrediction = predSnap.data() as MatchPrediction;
    if (currentPrediction.processed) return false;

    tx.update(predictionRef, {
      processed: true,
      pointsAwarded: points,
      updatedAt: now,
    });

    if (lbSnap.exists) {
      const current = lbSnap.data()!;
      tx.update(leaderboardRef, {
        score: (current.score ?? 0) + points,
        displayName: prediction.displayName || current.displayName,
        email: prediction.email || current.email,
        photoURL: prediction.photoURL || current.photoURL || '',
        updatedAt: now,
      });
    } else {
      tx.set(leaderboardRef, {
        userId: prediction.userId,
        displayName: prediction.displayName,
        email: prediction.email,
        photoURL: prediction.photoURL || '',
        score: points,
        matchesPredicted: 0,
        updatedAt: now,
      });
    }

    return true;
  });
}

export async function registerPredictionOnLeaderboard(input: {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  isNewPrediction: boolean;
}): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(LEADERBOARD_COLLECTION).doc(input.userId);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (snap.exists) {
      const updates: Record<string, unknown> = {
        displayName: input.displayName,
        email: input.email,
        photoURL: input.photoURL || '',
        updatedAt: now,
      };
      if (input.isNewPrediction) {
        updates.matchesPredicted = FieldValue.increment(1);
      }
      tx.update(ref, updates);
    } else {
      tx.set(ref, {
        userId: input.userId,
        displayName: input.displayName,
        email: input.email,
        photoURL: input.photoURL || '',
        score: 0,
        matchesPredicted: 1,
        updatedAt: now,
      });
    }
  });
}
