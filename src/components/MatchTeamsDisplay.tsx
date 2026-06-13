import React from 'react';
import { MatchData, TeamInfo } from '../types';
import { getMatchStatusInfo } from '../lib/matchUtils';

export function TeamFlag({ team, size = 'md' }: { team?: TeamInfo; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass =
    size === 'lg' ? 'w-12 h-12 text-4xl' : size === 'sm' ? 'w-6 h-6 text-xl' : 'w-10 h-10 text-3xl';
  if (team?.badgeUrl) {
    return <img src={team.badgeUrl} alt={team.name} className={`${sizeClass} object-contain`} />;
  }
  return <span className={sizeClass.split(' ')[2]}>{team?.flag ?? '🏳️'}</span>;
}

type MatchTeamsDisplayProps = {
  teamA: TeamInfo;
  teamB: TeamInfo;
  match: MatchData;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  teamAAccessory?: React.ReactNode;
  teamBAccessory?: React.ReactNode;
};

export function MatchTeamsDisplay({
  teamA,
  teamB,
  match,
  size = 'md',
  showStatus = true,
  teamAAccessory,
  teamBAccessory,
}: MatchTeamsDisplayProps) {
  const status = showStatus ? getMatchStatusInfo(match) : null;
  const nameClass =
    size === 'lg'
      ? 'font-bold text-center text-sm'
      : size === 'sm'
        ? 'font-medium text-gray-900 text-xs text-center'
        : 'font-semibold text-gray-900 text-sm text-center';
  const vsClass =
    size === 'lg'
      ? 'bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold'
      : 'bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold';

  const statusToneClass =
    status?.tone === 'live'
      ? 'text-red-600'
      : status?.tone === 'completed'
        ? 'text-gray-500'
        : 'text-gray-600';

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-2 w-1/3 relative">
          {teamAAccessory}
          <TeamFlag team={teamA} size={size} />
          <span className={nameClass}>{teamA.name}</span>
        </div>

        <div className="w-1/3 flex flex-col justify-center items-center">
          <div className={vsClass}>vs</div>
        </div>

        <div className="flex flex-col items-center gap-2 w-1/3 relative">
          {teamBAccessory}
          <TeamFlag team={teamB} size={size} />
          <span className={nameClass}>{teamB.name}</span>
        </div>
      </div>

      {status && (
        <div className="mt-3 text-center">
          {status.score && (
            <div className="inline-block text-2xl font-black text-gray-900 tracking-wider px-4 py-2 rounded-xl bg-gray-50">
              {status.score}
            </div>
          )}
          <span className={`text-[10px] font-bold uppercase mt-1 block ${statusToneClass}`}>
            {status.label}
          </span>
        </div>
      )}
    </div>
  );
}
