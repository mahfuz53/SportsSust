import React, { useEffect, useMemo, useState } from 'react';
import { User, MatchData, TeamInfo } from '../types';
import { Trophy, ChevronRight, Share2, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { TopPredictorsCarousel } from '../components/TopPredictorsCarousel';
import { useI18n } from '../lib/i18n';
import { MatchTeamsDisplay } from '../components/MatchTeamsDisplay';
import {
  canShowPredictCta,
  computeMatchStatus,
  formatGroupLabel,
  isMatchToday,
  resolveTeam,
  withComputedMatchStatuses,
} from '../lib/matchUtils';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useWorldCupData } from '../hooks/useWorldCupData';

export function DashboardScreen({
  onNavigate,
}: {
  onNavigate: (tab: string, matchId?: string) => void;
}) {
  const { leaderboard, isLoading: leaderboardLoading } = useLeaderboard();
  const { matches, teams } = useWorldCupData();
  const [tick, setTick] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const todaysMatches = useMemo(() => {
    void tick;
    return withComputedMatchStatuses(matches)
      .filter((m) => isMatchToday(m))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [matches, tick]);

  const handleShareChallenge = async () => {
    const shareText =
      'Join me on Sports SUST Prediction Challenge 26! Predict FIFA World Cup 2026 matches and win big! #FIFA26 #SportsSUST';
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Sports SUST Prediction Challenge 26',
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      await navigator.clipboard.writeText(shareText + ' ' + window.location.href);
      alert('Challenge link copied to clipboard!');
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto pb-24 pt-6 px-4 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900">{t('nav.dashboard')}</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Welcome to Challenge 26</p>
        </div>
        <button
          onClick={handleShareChallenge}
          className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 active:scale-95 transition-all shadow-sm border border-indigo-100"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('dashboard.top_predictors')}</h2>
          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">
            সেরা প্রেডিক্টর
          </span>
        </div>
        <TopPredictorsCarousel users={leaderboard} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{t('dashboard.quick_predict')}</h2>
          <span className="text-xs text-gray-500 font-medium">{format(new Date(), 'MMM d, yyyy')}</span>
        </div>
        <div className="space-y-4">
          {todaysMatches.length > 0 ? (
            todaysMatches.map((match) => (
              <QuickPredictCard
                key={match.id}
                match={match}
                teams={teams}
                onOpenMatch={(matchId) => onNavigate('matches', matchId)}
              />
            ))
          ) : (
            <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-500 text-sm border border-gray-100">
              No matches scheduled for today.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Main Leaderboard
          </h2>
          <button className="text-indigo-600 text-sm font-medium flex items-center">
            সব দেখুন <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {leaderboardLoading && leaderboard.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500 animate-pulse">
              Loading leaderboard...
            </div>
          )}
          {!leaderboardLoading && leaderboard.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">
              No predictions yet. Be the first to predict and climb the board!
            </div>
          )}
          {leaderboard.slice(0, 5).map((user, index) => (
            <div key={user.id} className="flex items-center p-4">
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center font-bold text-gray-500 text-sm mr-3">
                {index + 1}
              </div>
              <img src={user.avatar} className="w-10 h-10 rounded-full mr-3" alt="avatar" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm">{user.name}</h4>
                <p className="text-xs text-gray-500">{user.matchesPredicted} matches played</p>
              </div>
              <div className="font-bold text-indigo-600">{user.score}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickPredictCard({
  match,
  teams,
  onOpenMatch,
}: {
  match: MatchData;
  teams: TeamInfo[];
  onOpenMatch: (matchId: string) => void;
}) {
  const teamA = resolveTeam(teams, match.teamA, match.teamAName);
  const teamB = resolveTeam(teams, match.teamB, match.teamBName);
  const status = computeMatchStatus(match);
  const canPredict = canShowPredictCta(match);
  const isLive = status === 'live';

  return (
    <div
      onClick={() => onOpenMatch(match.id)}
      className="bg-white border text-left border-gray-100 shadow-sm rounded-2xl p-4 active:scale-95 transition-transform cursor-pointer"
    >
      <div className="flex justify-between items-center text-xs text-gray-500 font-medium mb-3">
        <span className="font-semibold text-indigo-700">{format(new Date(match.time), 'h:mm a')}</span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {formatGroupLabel(match)}
        </span>
      </div>

      <MatchTeamsDisplay teamA={teamA} teamB={teamB} match={match} />

      {canPredict && (
        <div className="mt-4 pt-4 border-t border-gray-50 text-center text-sm font-medium text-indigo-600">
          Tap to Predict &amp; Read Preview
        </div>
      )}
      {isLive && (
        <div className="mt-4 pt-4 border-t border-gray-50 text-center text-sm font-medium text-gray-500">
          Match in progress — tap for details
        </div>
      )}
    </div>
  );
}
