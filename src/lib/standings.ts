import type { GroupInfo, GroupStanding, MatchData } from '../types';

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
