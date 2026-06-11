import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  fixtureToMatchData,
  WORLDCUP_MATCHES_COLLECTION,
  type WorldcupFirestoreMatch,
} from '../lib/worldcupMatchTransform';
import type { MatchData, TeamInfo } from '../types';

function buildTeamIdResolver(teams: TeamInfo[]): (name: string) => string {
  const lookup = new Map<string, string>();
  for (const team of teams) {
    lookup.set(team.name.toLowerCase(), team.id);
    lookup.set(team.id.toLowerCase(), team.id);
  }
  return (name: string) =>
    lookup.get(name.toLowerCase()) ?? name.replace(/\s+/g, '-').toUpperCase();
}

export function useMatchDocument(matchId: string, teams: TeamInfo[]) {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) {
      setIsLoading(false);
      setError('Missing match ID.');
      return;
    }

    if (teams.length === 0) return;

    const resolveTeamId = buildTeamIdResolver(teams);
    const ref = doc(db, WORLDCUP_MATCHES_COLLECTION, matchId);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setMatch(null);
          setError('Match not found in Firestore.');
          setIsLoading(false);
          return;
        }

        const data = snapshot.data() as WorldcupFirestoreMatch;
        setMatch(
          fixtureToMatchData({ ...data, matchId: data.matchId ?? snapshot.id }, resolveTeamId)
        );
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error('[Firestore] match document error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [matchId, teams]);

  return { match, isLoading, error };
}
