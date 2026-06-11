import { useEffect, useRef } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { didWinnerBecomeFinalized } from '../lib/predictionUtils';
import { scorePredictionsForMatchInFirestore } from '../lib/predictionScoringFirestore';
import {
  WORLDCUP_MATCHES_COLLECTION,
  type WorldcupFirestoreMatch,
} from '../lib/worldcupMatchTransform';

/**
 * When an admin is signed in, watches worldcup_matches for winner transitions
 * (null → valid) and scores pending predictions automatically.
 */
export function useAutoScorePredictions(isAdmin: boolean, isAuthReady: boolean) {
  const previousWinnersRef = useRef<Map<string, string | null>>(new Map());
  const scoringInFlightRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isAuthReady || !isAdmin) {
      initializedRef.current = false;
      previousWinnersRef.current.clear();
      return;
    }

    const matchesQuery = query(
      collection(db, WORLDCUP_MATCHES_COLLECTION),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );

    const unsubscribe = onSnapshot(
      matchesQuery,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data() as WorldcupFirestoreMatch;
          const matchId = data.matchId ?? change.doc.id;
          const currentWinner = data.winner ?? null;

          if (!initializedRef.current) {
            previousWinnersRef.current.set(matchId, currentWinner);
            continue;
          }

          const previousWinner = previousWinnersRef.current.get(matchId) ?? null;
          previousWinnersRef.current.set(matchId, currentWinner);

          if (change.type !== 'modified') continue;
          if (!didWinnerBecomeFinalized(previousWinner, currentWinner)) continue;
          if (scoringInFlightRef.current.has(matchId)) continue;

          scoringInFlightRef.current.add(matchId);
          scorePredictionsForMatchInFirestore(matchId)
            .then(({ scored, skipped }) => {
              if (scored > 0) {
                console.log(
                  `[AutoScore] Awarded points for ${scored} prediction(s) on ${matchId} (${skipped} skipped).`
                );
              }
            })
            .catch((err) => {
              console.error(`[AutoScore] Failed to score predictions for ${matchId}:`, err);
            })
            .finally(() => {
              scoringInFlightRef.current.delete(matchId);
            });
        }

        initializedRef.current = true;
      },
      (err) => {
        console.error('[AutoScore] matches listener error:', err);
      }
    );

    return () => {
      unsubscribe();
      initializedRef.current = false;
      previousWinnersRef.current.clear();
      scoringInFlightRef.current.clear();
    };
  }, [isAdmin, isAuthReady]);
}
