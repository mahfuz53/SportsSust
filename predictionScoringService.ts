import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firestoreAdmin';
import { WORLDCUP_MATCHES_COLLECTION } from './src/lib/worldcupMatchTransform';
import { getActualChoice, isPredictionCorrect } from './src/lib/predictionUtils';
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
  const team1Score = match.team1Score;
  const team2Score = match.team2Score;

  if (team1Score === null || team2Score === undefined || team2Score === null) {
    return { scored: 0, skipped: 0 };
  }

  const actual = getActualChoice(match.team1, match.team2, team1Score, team2Score);
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

    await predDoc.ref.update({
      processed: true,
      pointsAwarded: points,
      updatedAt: Date.now(),
    });

    await applyLeaderboardPoints(prediction.userId, {
      displayName: prediction.displayName,
      email: prediction.email,
      photoURL: prediction.photoURL,
    }, points);

    scored += 1;
  }

  if (scored > 0) {
    console.log(`[Predictions] Scored ${scored} predictions for ${matchId}`);
  }

  return { scored, skipped };
}

async function applyLeaderboardPoints(
  userId: string,
  profile: { displayName: string; email: string; photoURL: string },
  pointsDelta: number
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(LEADERBOARD_COLLECTION).doc(userId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (snap.exists) {
      const current = snap.data()!;
      tx.update(ref, {
        score: (current.score ?? 0) + pointsDelta,
        displayName: profile.displayName || current.displayName,
        email: profile.email || current.email,
        photoURL: profile.photoURL || current.photoURL || '',
        updatedAt: now,
      });
    } else {
      tx.set(ref, {
        userId,
        displayName: profile.displayName,
        email: profile.email,
        photoURL: profile.photoURL || '',
        score: pointsDelta,
        matchesPredicted: 0,
        updatedAt: now,
      });
    }
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
