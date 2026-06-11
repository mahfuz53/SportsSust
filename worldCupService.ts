import fs from "fs";
import path from "path";
import { computeMatchStatus } from "./matchStatus";
import type { GroupInfo, GroupStanding, MatchData, TeamInfo } from "./src/types";

const DATA_DIR = path.join(process.cwd(), "data");
const RESULTS_FILE = path.join(DATA_DIR, "match-results.json");

type JsonTeam = {
  name: string;
  name_normalised?: string;
  continent?: string;
  flag_icon?: string;
  fifa_code: string;
  group: string;
  confed?: string;
};

type JsonMatch = {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
};

type JsonGroup = {
  name: string;
  teams: string[];
};

type MatchResultStore = Record<
  string,
  { scoreA: number; scoreB: number; source: string; updatedAt: string }
>;

let resultsStore: MatchResultStore = {};
let dataCache: {
  matches: MatchData[];
  teams: TeamInfo[];
  groups: GroupInfo[];
  standings: GroupStanding[];
} | null = null;

function readJson<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function loadResultsStore(): MatchResultStore {
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8")) as MatchResultStore;
    }
  } catch (err) {
    console.error("[WorldCup] Failed to load match results:", err);
  }
  return {};
}

function saveResultsStore(): void {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(resultsStore, null, 2));
}

function parseMatchDateTime(date: string, time: string): string {
  const utcMatch = time.match(/(\d{1,2}):(\d{2})\s+UTC([+-]?\d+)/i);
  if (utcMatch) {
    const hh = utcMatch[1].padStart(2, "0");
    const mm = utcMatch[2];
    let offset = utcMatch[3];
    if (!offset.startsWith("+") && !offset.startsWith("-")) offset = `+${offset}`;
    const sign = offset.startsWith("-") ? "-" : "+";
    const abs = String(Math.abs(parseInt(offset, 10))).padStart(2, "0");
    return `${date}T${hh}:${mm}:00${sign}${abs}:00`;
  }
  const timeMatch = time.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return `${date}T${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00.000Z`;
  }
  return `${date}T12:00:00.000Z`;
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

function buildTeams(teamsJson: JsonTeam[]): TeamInfo[] {
  return teamsJson.map((team, index) => ({
    id: team.fifa_code,
    name: team.name,
    flag: team.flag_icon ?? "🏳️",
    rank: index + 1,
    group: team.group,
    confederation: team.confed,
    continent: team.continent,
    introBench: `${team.name} represent ${team.continent ?? "their region"} in Group ${team.group} at the FIFA World Cup 2026.`,
    introBn: `${team.name} ফিফা বিশ্বকাপ ২০২৬-এ গ্রুপ ${team.group}-এ প্রতিদ্বন্দ্বিতা করছে।`,
    history: `Confederation: ${team.confed ?? "N/A"}. FIFA code: ${team.fifa_code}.`,
    historyBn: `কনফেডারেশন: ${team.confed ?? "N/A"}।`,
    qualification: `Qualified for FIFA World Cup 2026 — Group ${team.group}.`,
    players: [],
  }));
}

function buildGroups(groupsJson: JsonGroup[], teams: TeamInfo[]): GroupInfo[] {
  const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t]));

  return groupsJson.map((group) => ({
    name: group.name.replace("Group ", ""),
    teams: group.teams
      .map((name) => teamByName.get(name.toLowerCase()))
      .filter((team): team is TeamInfo => Boolean(team)),
  }));
}

function buildMatches(
  fixturesJson: { matches: JsonMatch[] },
  teamLookup: Map<string, JsonTeam>
): MatchData[] {
  return fixturesJson.matches.map((fixture, index) => {
    const id = `WC-${String(index + 1).padStart(3, "0")}`;
    const teamA = resolveTeamId(fixture.team1, teamLookup);
    const teamB = resolveTeamId(fixture.team2, teamLookup);
    const stored = resultsStore[id];
    const group = fixture.group?.replace("Group ", "") ?? fixture.round;
    const kickoff = parseMatchDateTime(fixture.date, fixture.time);

    const scoreA: number | null = stored?.scoreA ?? null;
    const scoreB: number | null = stored?.scoreB ?? null;
    const status = computeMatchStatus({ time: kickoff });

    return {
      id,
      teamA,
      teamB,
      teamAName: fixture.team1,
      teamBName: fixture.team2,
      time: kickoff,
      status,
      group,
      round: fixture.round,
      scoreA,
      scoreB,
      venue: fixture.ground,
      preMatchAnalysis: null,
      postMatchAnalysis: null,
    };
  });
}

type TeamStats = {
  teamId: string;
  teamName: string;
  group: string;
  mp: number;
  gf: number;
  ga: number;
  pts: number;
};

export function calculateStandings(matches: MatchData[], groups: GroupInfo[]): GroupStanding[] {
  const stats = new Map<string, TeamStats>();

  for (const group of groups) {
    for (const team of group.teams) {
      stats.set(`${group.name}:${team.id}`, {
        teamId: team.id,
        teamName: team.name,
        group: group.name,
        mp: 0,
        gf: 0,
        ga: 0,
        pts: 0,
      });
    }
  }

  for (const match of matches) {
    if (!match.group || !match.group.match(/^([A-L])$/)) continue;
    if (match.scoreA === null || match.scoreB === null) continue;

    const keyA = `${match.group}:${match.teamA}`;
    const keyB = `${match.group}:${match.teamB}`;
    const statA = stats.get(keyA);
    const statB = stats.get(keyB);
    if (!statA || !statB) continue;

    statA.mp += 1;
    statB.mp += 1;
    statA.gf += match.scoreA;
    statA.ga += match.scoreB;
    statB.gf += match.scoreB;
    statB.ga += match.scoreA;

    if (match.scoreA > match.scoreB) {
      statA.pts += 3;
    } else if (match.scoreA < match.scoreB) {
      statB.pts += 3;
    } else {
      statA.pts += 1;
      statB.pts += 1;
    }
  }

  const standings: GroupStanding[] = [];

  for (const group of groups) {
    const rows = Array.from(stats.values())
      .filter((row) => row.group === group.name)
      .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);

    rows.forEach((row, index) => {
      const gd = row.gf - row.ga;
      standings.push({
        teamId: row.teamId,
        teamName: row.teamName,
        group: row.group,
        mp: row.mp,
        gf: row.gf,
        gd: gd >= 0 ? `+${gd}` : String(gd),
        pts: row.pts,
        rank: index + 1,
      });
    });
  }

  return standings;
}

function loadWorldCupData() {
  const teamsJson = readJson<JsonTeam[]>("worldcup.teams.json");
  const groupsJson = readJson<{ groups: JsonGroup[] }>("worldcup.groups.json");
  const fixturesJson = readJson<{ matches: JsonMatch[] }>("worldcup.json");

  const teamLookup = buildTeamLookup(teamsJson);
  const teams = buildTeams(teamsJson);
  const groups = buildGroups(groupsJson.groups, teams);
  const matches = buildMatches(fixturesJson, teamLookup).sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  const standings = calculateStandings(matches, groups);

  return { matches, teams, groups, standings };
}

export function initWorldCupData(): void {
  resultsStore = loadResultsStore();
  dataCache = loadWorldCupData();
  console.log(
    `[WorldCup] Loaded ${dataCache.matches.length} fixtures, ${dataCache.teams.length} teams, ${dataCache.groups.length} groups`
  );
}

export function getWorldCupData() {
  if (!dataCache) initWorldCupData();
  return dataCache!;
}

export function refreshWorldCupData() {
  resultsStore = loadResultsStore();
  dataCache = loadWorldCupData();
  return dataCache;
}

export function getTeamName(teams: TeamInfo[], teamId: string, fallback?: string): string {
  return teams.find((team) => team.id === teamId)?.name ?? fallback ?? teamId;
}

export function updateMatchResult(
  matchId: string,
  scoreA: number,
  scoreB: number,
  source = "gemini"
): MatchData | null {
  if (!dataCache) initWorldCupData();

  const match = dataCache!.matches.find((m) => m.id === matchId);
  if (!match) return null;

  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.status = computeMatchStatus(match);

  resultsStore[matchId] = {
    scoreA,
    scoreB,
    source,
    updatedAt: new Date().toISOString(),
  };
  saveResultsStore();

  dataCache!.standings = calculateStandings(dataCache!.matches, dataCache!.groups);
  console.log(`[WorldCup] Updated ${matchId}: ${scoreA}-${scoreB}, standings recalculated`);

  return match;
}

export function getGroupStageMatches(): MatchData[] {
  const { matches } = getWorldCupData();
  return matches.filter((m) => m.group?.match(/^[A-L]$/));
}
