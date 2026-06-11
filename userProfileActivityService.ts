import fs from "fs";
import path from "path";
import { fetchAllWorldcupMatches, getAdminFirestore } from "./firestoreAdmin";
import { getUserPredictionAdmin } from "./predictionScoringService";
import { choiceLabel } from "./src/lib/predictionUtils";
import {
  formatMatchWinnerLabel,
  type WorldcupFirestoreMatch,
} from "./src/lib/worldcupMatchTransform";
import {
  LEADERBOARD_COLLECTION,
  PREDICTIONS_SUBCOLLECTION,
  type LeaderboardEntry,
  type MatchPrediction,
} from "./src/lib/predictionTypes";

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

type TeamJson = {
  name: string;
  name_normalised?: string;
  flag_icon?: string;
};

function loadTeamFlags(): Map<string, string> {
  const filePath = path.join(process.cwd(), "data", "worldcup.teams.json");
  const teams = JSON.parse(fs.readFileSync(filePath, "utf-8")) as TeamJson[];
  const map = new Map<string, string>();

  for (const team of teams) {
    const flag = team.flag_icon ?? "🏳️";
    map.set(team.name.toLowerCase(), flag);
    if (team.name_normalised) {
      map.set(team.name_normalised.toLowerCase(), flag);
    }
  }

  return map;
}

function teamFlag(flags: Map<string, string>, name: string): string {
  return flags.get(name.toLowerCase()) ?? "🏳️";
}

function formatMatchDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function matchActualResult(match: WorldcupFirestoreMatch): string | null {
  if (match.team1Score === null || match.team2Score === null) return null;
  if (match.winner) return formatMatchWinnerLabel(match.winner);
  if (match.team1Score === match.team2Score) return "Draw";
  return match.team1Score > match.team2Score ? match.team1 : match.team2;
}

async function fetchAllUserPredictions(userId: string): Promise<MatchPrediction[]> {
  const db = getAdminFirestore();

  try {
    const snap = await db
      .collectionGroup(PREDICTIONS_SUBCOLLECTION)
      .where("userId", "==", userId)
      .get();
    return snap.docs.map((doc) => doc.data() as MatchPrediction);
  } catch (err) {
    console.warn("[Profile] collectionGroup query failed, scanning matches:", err);
    const matches = await fetchAllWorldcupMatches();
    const predictions: MatchPrediction[] = [];

    for (const match of matches) {
      const prediction = await getUserPredictionAdmin(match.matchId, userId);
      if (prediction) predictions.push(prediction);
    }

    return predictions;
  }
}

async function getLeaderboardRank(userId: string): Promise<{
  rank: number | null;
  totalPlayers: number;
  entry: LeaderboardEntry | null;
}> {
  const db = getAdminFirestore();
  const snap = await db.collection(LEADERBOARD_COLLECTION).orderBy("score", "desc").get();
  const totalPlayers = snap.size;
  const index = snap.docs.findIndex((doc) => doc.id === userId);
  const entry = index >= 0 ? (snap.docs[index].data() as LeaderboardEntry) : null;

  return {
    rank: index >= 0 ? index + 1 : null,
    totalPlayers,
    entry,
  };
}

export async function getUserProfileActivity(userId: string): Promise<UserProfileActivity> {
  const [predictions, matches, leaderboard, flags] = await Promise.all([
    fetchAllUserPredictions(userId),
    fetchAllWorldcupMatches(),
    getLeaderboardRank(userId),
    Promise.resolve(loadTeamFlags()),
  ]);

  const matchMap = new Map(matches.map((match) => [match.matchId, match]));

  const totalScore = leaderboard.entry?.score ?? 0;
  const matchesPredicted =
    leaderboard.entry?.matchesPredicted ?? predictions.length;

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
      const dateA = matchMap.get(a.matchId)?.date ?? "";
      const dateB = matchMap.get(b.matchId)?.date ?? "";
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
