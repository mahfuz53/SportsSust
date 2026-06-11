import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { LEADERBOARD_COLLECTION, type LeaderboardEntry } from '../lib/predictionTypes';
import type { User } from '../types';

function toUser(entry: LeaderboardEntry): User {
  return {
    id: entry.userId,
    name: entry.displayName || 'Predictor',
    score: entry.score ?? 0,
    matchesPredicted: entry.matchesPredicted ?? 0,
    avatar: entry.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.displayName || 'U')}&background=4f46e5&color=fff`,
  };
}

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, LEADERBOARD_COLLECTION), orderBy('score', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries = snapshot.docs.map((docSnap) => docSnap.data() as LeaderboardEntry);
        setLeaderboard(entries.map(toUser));
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[Firestore] leaderboard error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { leaderboard, isLoading, error };
}
