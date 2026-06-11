import fs from "fs";
import path from "path";
import { fetchAllWorldcupMatches, updateWorldcupMatchResult } from "./firestoreAdmin";
import { computeMatchStatus } from "./matchStatus";
import { calculateStandings } from "./src/lib/standings";
import {
  fixtureToMatchData,
  resolveWinnerFromScores,
  type WorldcupFirestoreMatch,
} from "./src/lib/worldcupMatchTransform";
import { buildGroupsFromJson, buildTeamsFromJson } from "./src/lib/worldCupMeta";
import type { GroupInfo, GroupStanding, MatchData, TeamInfo } from "./src/types";

const DATA_DIR = path.join(process.cwd(), "data");

type JsonTeam = {
  name: string;
  name_normalised?: string;
  continent?: string;
  flag_icon?: string;
  fifa_code: string;
  group: string;
  confed?: string;
};

type JsonGroup = {
  name: string;
  teams: string[];
};

let dataCache: {
  matches: MatchData[];
  teams: TeamInfo[];
  groups: GroupInfo[];
  standings: GroupStanding[];
} | null = null;

let initPromise: Promise<void> | null = null;

function readJson<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function buildTeamLookup(teamsJson: JsonTeam[]): Map<string, JsonTeam> {
  const lookup = new Map<string, JsonTeam>();
  for (const team of teamsJson) {
    lookup.set(team.name.toLowerCase(), team);
    if (team.name_normalised) {
      lookup.set(team.name_normalised.toLowerCase(), team);
    }
    lookup.set(team.fifa_code.toLowerCase(), team);
  }
  return lookup;
}

function resolveTeamId(name: string, lookup: Map<string, JsonTeam>): string {
  const team = lookup.get(name.toLowerCase());
  return team?.fifa_code ?? name.replace(/\s+/g, "-").toUpperCase();
}

function buildMatchesFromFixtures(
  fixtures: WorldcupFirestoreMatch[],
  teamLookup: Map<string, JsonTeam>
): MatchData[] {
  const resolveId = (name: string) => resolveTeamId(name, teamLookup);
  return fixtures
    .map((fixture) => fixtureToMatchData(fixture, resolveId))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

async function loadWorldCupData() {
  const teamsJson = readJson<JsonTeam[]>("worldcup.teams.json");
  const groupsJson = readJson<{ groups: JsonGroup[] }>("worldcup.groups.json");

  const teamLookup = buildTeamLookup(teamsJson);
  const teams = buildTeamsFromJson(teamsJson);
  const groups = buildGroupsFromJson(groupsJson.groups, teams);

  const fixtures = await fetchAllWorldcupMatches();
  const matches = buildMatchesFromFixtures(fixtures, teamLookup);
  const standings = calculateStandings(matches, groups);

  return { matches, teams, groups, standings };
}

export async function initWorldCupData(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        dataCache = await loadWorldCupData();
        console.log(
          `[WorldCup] Loaded ${dataCache.matches.length} matches from Firestore, ${dataCache.teams.length} teams, ${dataCache.groups.length} groups`
        );
      } catch (err) {
        initPromise = null;
        console.error("[WorldCup] Failed to load from Firestore:", err);
        throw err;
      }
    })();
  }
  return initPromise;
}

export function getWorldCupData() {
  if (!dataCache) {
    throw new Error("World Cup data not initialized. Call await initWorldCupData() first.");
  }
  return dataCache;
}

export async function refreshWorldCupData() {
  dataCache = await loadWorldCupData();
  return dataCache;
}

export function getTeamName(teams: TeamInfo[], teamId: string, fallback?: string): string {
  return teams.find((team) => team.id === teamId)?.name ?? fallback ?? teamId;
}

export async function updateMatchResult(
  matchId: string,
  scoreA: number,
  scoreB: number,
  _source = "gemini"
): Promise<MatchData | null> {
  if (!dataCache) await initWorldCupData();

  const match = dataCache!.matches.find((m) => m.id === matchId);
  if (!match) return null;

  const winner = resolveWinnerFromScores(
    match.teamAName ?? match.teamA,
    match.teamBName ?? match.teamB,
    scoreA,
    scoreB
  );

  await updateWorldcupMatchResult(matchId, scoreA, scoreB, winner);

  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winner = winner;
  match.status = computeMatchStatus(match);

  dataCache!.standings = calculateStandings(dataCache!.matches, dataCache!.groups);
  console.log(`[WorldCup] Updated ${matchId} in Firestore: ${scoreA}-${scoreB}`);

  return match;
}

export function getGroupStageMatches(): MatchData[] {
  const { matches } = getWorldCupData();
  return matches.filter((m) => m.group?.match(/^[A-L]$/));
}

export { calculateStandings };
