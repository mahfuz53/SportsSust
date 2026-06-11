import { auth } from '../firebase';
import type { MatchPrediction, PredictionChoice } from './predictionTypes';
import {
  fetchMyPredictionFromFirestore,
  submitPredictionToFirestore,
} from './predictionsFirestore';

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

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid response from server.'
        : `Server error (${res.status}). Ensure the Node API is running or use Firestore rules.`
    );
  }
}

/** Prefer Firestore (works on static hosting); fall back to API when available. */
export async function fetchMyPrediction(matchId: string): Promise<MatchPrediction | null> {
  try {
    return await fetchMyPredictionFromFirestore(matchId);
  } catch (firestoreErr) {
    console.warn('[Predictions] Firestore read failed, trying API:', firestoreErr);
  }

  const headers = await authHeaders();
  const res = await fetch(`/api/predictions/me?matchId=${encodeURIComponent(matchId)}`, {
    headers,
  });
  const data = await parseJsonResponse<{ prediction?: MatchPrediction | null; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load your prediction.');
  }
  return data.prediction ?? null;
}

export async function submitPrediction(
  matchId: string,
  choice: PredictionChoice
): Promise<MatchPrediction> {
  try {
    return await submitPredictionToFirestore(matchId, choice);
  } catch (firestoreErr) {
    console.warn('[Predictions] Firestore write failed, trying API:', firestoreErr);
  }

  const res = await fetch('/api/predictions/submit', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ matchId, choice }),
  });
  const data = await parseJsonResponse<{ prediction?: MatchPrediction; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save prediction.');
  }
  if (!data.prediction) {
    throw new Error('Failed to save prediction.');
  }
  return data.prediction;
}
