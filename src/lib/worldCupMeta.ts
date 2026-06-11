import teamsJson from '../../data/worldcup.teams.json';
import groupsFile from '../../data/worldcup.groups.json';
import type { GroupInfo, TeamInfo } from '../types';

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

export function buildTeamsFromJson(teams: JsonTeam[]): TeamInfo[] {
  return teams.map((team, index) => ({
    id: team.fifa_code,
    name: team.name,
    flag: team.flag_icon ?? '🏳️',
    rank: index + 1,
    group: team.group,
    confederation: team.confed,
    continent: team.continent,
    introBench: `${team.name} represent ${team.continent ?? 'their region'} in Group ${team.group} at the FIFA World Cup 2026.`,
    introBn: `${team.name} ফিফা বিশ্বকাপ ২০২৬-এ গ্রুপ ${team.group}-এ প্রতিদ্বন্দ্বিতা করছে।`,
    history: `Confederation: ${team.confed ?? 'N/A'}. FIFA code: ${team.fifa_code}.`,
    historyBn: `কনফেডারেশন: ${team.confed ?? 'N/A'}।`,
    qualification: `Qualified for FIFA World Cup 2026 — Group ${team.group}.`,
    players: [],
  }));
}

export function buildGroupsFromJson(groups: JsonGroup[], teams: TeamInfo[]): GroupInfo[] {
  const teamByName = new Map(teams.map((team) => [team.name.toLowerCase(), team]));

  return groups.map((group) => ({
    name: group.name.replace('Group ', ''),
    teams: group.teams
      .map((name) => teamByName.get(name.toLowerCase()))
      .filter((team): team is TeamInfo => Boolean(team)),
  }));
}

/** Client-safe teams + groups metadata (no server API required). */
export function loadWorldCupMeta(): { teams: TeamInfo[]; groups: GroupInfo[] } {
  const teams = buildTeamsFromJson(teamsJson as JsonTeam[]);
  const groups = buildGroupsFromJson((groupsFile as { groups: JsonGroup[] }).groups, teams);
  return { teams, groups };
}
