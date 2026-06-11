import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { WORLDCUP_MATCHES_COLLECTION } from './worldcupMatchTransform';
import {
  LEADERBOARD_COLLECTION,
  PREDICTIONS_SUBCOLLECTION,
  type MatchPrediction,
  type PredictionChoice,
} from './predictionTypes';

function predictionDocRef(matchId: string, userId: string) {
  return doc(
    db,
    WORLDCUP_MATCHES_COLLECTION,
    matchId,
    PREDICTIONS_SUBCOLLECTION,
    userId
  );
}

function leaderboardDocRef(userId: string) {
  return doc(db, LEADERBOARD_COLLECTION, userId);
}

async function registerPredictionOnLeaderboard(input: {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  isNewPrediction: boolean;
}): Promise<void> {
  const ref = leaderboardDocRef(input.userId);
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (snap.exists()) {
      const current = snap.data();
      tx.update(ref, {
        displayName: input.displayName,
        email: input.email,
        photoURL: input.photoURL || '',
        updatedAt: now,
        ...(input.isNewPrediction
          ? { matchesPredicted: (current.matchesPredicted ?? 0) + 1 }
          : {}),
      });
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

export async function fetchMyPredictionFromFirestore(
  matchId: string
): Promise<MatchPrediction | null> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to manage predictions.');
  }

  const snap = await getDoc(predictionDocRef(matchId, user.uid));
  return snap.exists() ? (snap.data() as MatchPrediction) : null;
}

export async function submitPredictionToFirestore(
  matchId: string,
  choice: PredictionChoice
): Promise<MatchPrediction> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to manage predictions.');
  }

  const ref = predictionDocRef(matchId, user.uid);
  const existing = await getDoc(ref);

  if (existing.exists() && (existing.data() as MatchPrediction).processed) {
    throw new Error('This prediction has already been scored and cannot be changed.');
  }

  const isUpdate = existing.exists();
  const now = Date.now();
  const data: MatchPrediction = {
    userId: user.uid,
    matchId,
    choice,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL ?? '',
    createdAt: isUpdate ? (existing.data() as MatchPrediction).createdAt : now,
    updatedAt: now,
    processed: false,
    pointsAwarded: null,
  };

  await setDoc(ref, data);

  await registerPredictionOnLeaderboard({
    userId: user.uid,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL,
    isNewPrediction: !isUpdate,
  });

  return data;
}
