import { auth } from '../firebase';
import { fetchUserProfileActivityFromFirestore } from './profileActivityFirestore';

export type ScoringHistoryPoint = {
  matchId: string;
  label: string;
  pointsDelta: number;
  cumulativeScore: number;
  scoredAt: number;
};

export type PastPredictionItem = {
  matchId: string;
  matchDate: string;
  team1Name: string;
  team2Name: string;
  team1Flag: string;
  team2Flag: string;
  predicted: string;
  actual: string | null;
  isCorrect: boolean | null;
  pointsEarned: number | null;
  processed: boolean;
};

export type UserProfileActivity = {
  totalScore: number;
  matchesPredicted: number;
  leaderboardRank: number | null;
  totalPlayers: number;
  scoringHistory: ScoringHistoryPoint[];
  pastPredictions: PastPredictionItem[];
};

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid response from server.'
        : `Server error (${res.status}). Ensure the Node API is running or use Firestore.`
    );
  }
}

/** Prefer Firestore (works on static hosting); fall back to API when available. */
export async function fetchUserProfileActivity(): Promise<UserProfileActivity> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to view profile activity.');
  }

  try {
    return await fetchUserProfileActivityFromFirestore(user.uid);
  } catch (firestoreErr) {
    console.warn('[Profile] Firestore activity failed, trying API:', firestoreErr);
  }

  const idToken = await user.getIdToken();
  const res = await fetch('/api/profile/activity', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await parseJsonResponse<UserProfileActivity & { error?: string }>(res);

  if (!res.ok) {
    throw new Error(data.error || 'Failed to load profile activity.');
  }

  return data;
}
