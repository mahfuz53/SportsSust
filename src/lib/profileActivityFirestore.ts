import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { choiceLabel } from './predictionUtils';
import {
  LEADERBOARD_COLLECTION,
  PREDICTIONS_SUBCOLLECTION,
  type LeaderboardEntry,
  type MatchPrediction,
} from './predictionTypes';
import type {
  PastPredictionItem,
  ScoringHistoryPoint,
  UserProfileActivity,
} from './profileActivityApi';
import { loadWorldCupMeta } from './worldCupMeta';
import {
  WORLDCUP_MATCHES_COLLECTION,
  type WorldcupFirestoreMatch,
} from './worldcupMatchTransform';

function teamFlagMap(): Map<string, string> {
  const { teams } = loadWorldCupMeta();
  const map = new Map<string, string>();
  for (const team of teams) {
    map.set(team.name.toLowerCase(), team.flag);
    map.set(team.id.toLowerCase(), team.flag);
  }
  return map;
}

function teamFlag(flags: Map<string, string>, name: string): string {
  return flags.get(name.toLowerCase()) ?? '🏳️';
}

function formatMatchDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function matchActualResult(match: WorldcupFirestoreMatch): string | null {
  if (match.team1Score === null || match.team2Score === null) return null;
  if (match.winner) return match.winner;
  if (match.team1Score === match.team2Score) return 'Draw';
  return match.team1Score > match.team2Score ? match.team1 : match.team2;
}

async function fetchAllMatches(): Promise<WorldcupFirestoreMatch[]> {
  const snap = await getDocs(collection(db, WORLDCUP_MATCHES_COLLECTION));
  return snap.docs.map((matchDoc) => {
    const data = matchDoc.data() as WorldcupFirestoreMatch;
    return { ...data, matchId: data.matchId ?? matchDoc.id };
  });
}

async function fetchAllUserPredictions(userId: string): Promise<MatchPrediction[]> {
  try {
    const predictionsQuery = query(
      collectionGroup(db, PREDICTIONS_SUBCOLLECTION),
      where('userId', '==', userId)
    );
    const snap = await getDocs(predictionsQuery);
    return snap.docs.map((predictionDoc) => predictionDoc.data() as MatchPrediction);
  } catch (err) {
    console.warn('[Profile] collectionGroup query failed, scanning matches:', err);
    const matches = await fetchAllMatches();
    const predictions = await Promise.all(
      matches.map(async (match) => {
        const predSnap = await getDoc(
          doc(db, WORLDCUP_MATCHES_COLLECTION, match.matchId, PREDICTIONS_SUBCOLLECTION, userId)
        );
        return predSnap.exists() ? (predSnap.data() as MatchPrediction) : null;
      })
    );
    return predictions.filter((item): item is MatchPrediction => Boolean(item));
  }
}

async function getLeaderboardRank(userId: string): Promise<{
  rank: number | null;
  totalPlayers: number;
  entry: LeaderboardEntry | null;
}> {
  const snap = await getDocs(
    query(collection(db, LEADERBOARD_COLLECTION), orderBy('score', 'desc'))
  );
  const totalPlayers = snap.size;
  const index = snap.docs.findIndex((leaderDoc) => leaderDoc.id === userId);
  const entry = index >= 0 ? (snap.docs[index].data() as LeaderboardEntry) : null;

  return {
    rank: index >= 0 ? index + 1 : null,
    totalPlayers,
    entry,
  };
}

export async function fetchUserProfileActivityFromFirestore(
  userId: string
): Promise<UserProfileActivity> {
  const [predictions, matches, leaderboard, flags] = await Promise.all([
    fetchAllUserPredictions(userId),
    fetchAllMatches(),
    getLeaderboardRank(userId),
    Promise.resolve(teamFlagMap()),
  ]);

  const matchMap = new Map(matches.map((match) => [match.matchId, match]));

  const totalScore = leaderboard.entry?.score ?? 0;
  const matchesPredicted = leaderboard.entry?.matchesPredicted ?? predictions.length;

  const processed = predictions
    .filter((p) => p.processed && p.pointsAwarded !== null)
    .sort((a, b) => a.updatedAt - b.updatedAt);

  let cumulative = 0;
  const scoringHistory: ScoringHistoryPoint[] = processed.map((prediction) => {
    cumulative += prediction.pointsAwarded!;
    return {
      matchId: prediction.matchId,
      label: prediction.matchId,
      pointsDelta: prediction.pointsAwarded!,
      cumulativeScore: cumulative,
      scoredAt: prediction.updatedAt,
    };
  });

  const pastPredictions: PastPredictionItem[] = predictions
    .map((prediction) => {
      const match = matchMap.get(prediction.matchId);
      if (!match) return null;

      const actual = matchActualResult(match);
      const predicted = choiceLabel(prediction.choice, match.team1, match.team2);

      return {
        matchId: prediction.matchId,
        matchDate: formatMatchDate(match.date),
        team1Name: match.team1,
        team2Name: match.team2,
        team1Flag: teamFlag(flags, match.team1),
        team2Flag: teamFlag(flags, match.team2),
        predicted,
        actual,
        isCorrect: prediction.processed ? (prediction.pointsAwarded ?? 0) > 0 : null,
        pointsEarned: prediction.processed ? prediction.pointsAwarded : null,
        processed: prediction.processed,
      };
    })
    .filter((item): item is PastPredictionItem => Boolean(item))
    .sort((a, b) => {
      const dateA = matchMap.get(a.matchId)?.date ?? '';
      const dateB = matchMap.get(b.matchId)?.date ?? '';
      return dateB.localeCompare(dateA);
    });

  return {
    totalScore,
    matchesPredicted,
    leaderboardRank: leaderboard.rank,
    totalPlayers: leaderboard.totalPlayers,
    scoringHistory,
    pastPredictions,
  };
}
