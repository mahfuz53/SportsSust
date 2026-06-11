import React, { useEffect, useMemo, useState } from 'react';
import { User, MatchData, TeamInfo } from '../types';
import { Trophy, ChevronRight, Share2, MessageSquare, TrendingUp, ThumbsUp, MapPin } from 'lucide-react';
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

const BUZZ_FEED = [
  { id: '1', user: 'Shakil Ahmed', text: 'Germany looking very strong this year! Expecting a solid 2-0 win in their opener.', likes: 24, time: '2m ago' },
  { id: '2', user: 'Nadia I.', text: 'Trending: 82% of top predictors are backing Brazil vs Switzerland! 🇧🇷', likes: 156, time: '15m ago', isSystem: true },
  { id: '3', user: 'Tahmid Rahman', text: 'Are we underestimating the underdogs here? The draw might be the smart prediction.', likes: 8, time: '1h ago' },
];

export function DashboardScreen({
  onNavigate,
}: {
  onNavigate: (tab: string, matchId?: string) => void;
}) {
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [tick, setTick] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    Promise.all([
      fetch('/api/leaderboard').then((res) => res.json()),
      fetch('/api/matches').then((res) => res.json()),
      fetch('/api/teams').then((res) => res.json()),
    ]).then(([lData, mData, tData]) => {
      if (Array.isArray(lData)) setLeaderboard(lData);
      if (Array.isArray(mData)) setMatches(mData);
      if (Array.isArray(tData)) setTeams(tData);
    });
  }, []);

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
            <TrendingUp className="w-5 h-5 text-pink-500" />
            {t('dashboard.community_buzz')}
          </h2>
        </div>
        <div className="space-y-3">
          {BUZZ_FEED.map((buzz) => (
            <div
              key={buzz.id}
              className={`bg-white rounded-2xl p-4 shadow-sm border ${buzz.isSystem ? 'border-pink-100 bg-pink-50/30' : 'border-gray-100'} flex gap-3`}
            >
              <div
                className={`w-8 h-8 rounded-full ${buzz.isSystem ? 'bg-pink-100 text-pink-600' : 'bg-indigo-50 text-indigo-600'} flex items-center justify-center shrink-0`}
              >
                {buzz.isSystem ? <TrendingUp className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-gray-900 text-sm">{buzz.user}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{buzz.time}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-2">{buzz.text}</p>
                <div className="flex gap-4">
                  <button className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {buzz.likes}
                  </button>
                  <button className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Reply
                  </button>
                </div>
              </div>
            </div>
          ))}
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
