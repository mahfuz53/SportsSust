import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateStandings } from '../lib/standings';
import {
  fixtureToMatchData,
  WORLDCUP_MATCHES_COLLECTION,
  type WorldcupFirestoreMatch,
} from '../lib/worldcupMatchTransform';
import type { GroupInfo, GroupStanding, MatchData, TeamInfo } from '../types';

function buildTeamIdResolver(teams: TeamInfo[]): (name: string) => string {
  const lookup = new Map<string, string>();
  for (const team of teams) {
    lookup.set(team.name.toLowerCase(), team.id);
    lookup.set(team.id.toLowerCase(), team.id);
  }
  return (name: string) =>
    lookup.get(name.toLowerCase()) ?? name.replace(/\s+/g, '-').toUpperCase();
}

export function useWorldCupData() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matchesReady, setMatchesReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      try {
        const [teamsRes, groupsRes] = await Promise.all([
          fetch('/api/teams'),
          fetch('/api/groups'),
        ]);

        const [teamsData, groupsData] = await Promise.all([
          teamsRes.json(),
          groupsRes.json(),
        ]);

        if (cancelled) return;

        if (!teamsRes.ok) {
          throw new Error(teamsData.error || 'Failed to load teams.');
        }
        if (!groupsRes.ok) {
          throw new Error(groupsData.error || 'Failed to load groups.');
        }

        setTeams(teamsData);
        setGroups(groupsData);
        setMetaReady(true);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setLoadError(err instanceof Error ? err.message : 'Failed to load team data.');
          setIsLoading(false);
        }
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!metaReady || teams.length === 0) return;

    const resolveTeamId = buildTeamIdResolver(teams);
    const matchesQuery = query(
      collection(db, WORLDCUP_MATCHES_COLLECTION),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );

    const unsubscribe = onSnapshot(
      matchesQuery,
      (snapshot) => {
        const nextMatches = snapshot.docs.map((doc) => {
          const data = doc.data() as WorldcupFirestoreMatch;
          return fixtureToMatchData(
            { ...data, matchId: data.matchId ?? doc.id },
            resolveTeamId
          );
        });
        setMatches(nextMatches);
        setMatchesReady(true);
        setLoadError(null);
      },
      (err) => {
        console.error('[Firestore] matches listener error:', err);
        setLoadError(
          err.message.includes('index')
            ? 'Firestore index required. Deploy firestore.indexes.json and try again.'
            : `Could not load matches from Firestore: ${err.message}`
        );
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [metaReady, teams]);

  useEffect(() => {
    if (metaReady && matchesReady) {
      setIsLoading(false);
    }
  }, [metaReady, matchesReady]);

  const standings = useMemo(
    () => calculateStandings(matches, groups),
    [matches, groups]
  );

  return {
    matches,
    teams,
    groups,
    standings,
    isLoading,
    loadError,
  };
}
