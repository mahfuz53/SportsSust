import { auth } from '../firebase';
import type { MatchPrediction, PredictionChoice } from './predictionTypes';

async function authHeaders(): Promise<HeadersInit> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('You must be signed in to manage predictions.');
  }
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchMyPrediction(matchId: string): Promise<MatchPrediction | null> {
  const headers = await authHeaders();
  const res = await fetch(`/api/predictions/me?matchId=${encodeURIComponent(matchId)}`, {
    headers,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load your prediction.');
  }
  return data.prediction ?? null;
}

export async function submitPrediction(
  matchId: string,
  choice: PredictionChoice
): Promise<MatchPrediction> {
  const res = await fetch('/api/predictions/submit', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ matchId, choice }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save prediction.');
  }
  return data.prediction as MatchPrediction;
}
