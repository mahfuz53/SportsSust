import { auth } from '../firebase';

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

export async function fetchUserProfileActivity(): Promise<UserProfileActivity> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('You must be signed in to view profile activity.');
  }

  const res = await fetch('/api/profile/activity', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to load profile activity.');
  }

  return data as UserProfileActivity;
}
