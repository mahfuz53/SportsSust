import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GroupInfo, GroupStanding, MatchData, TeamInfo } from '../types';
import { format } from 'date-fns';
import { ChevronLeft, MapPin, RefreshCw, Share2, Search, Star, AlertCircle, Shield, Save } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMatchDocument } from '../hooks/useMatchDocument';
import { useUserPrediction } from '../hooks/useUserPrediction';
import { updateMatchResultInFirestore } from '../lib/matchResultFirestore';
import { submitPrediction } from '../lib/predictionsApi';
import { choiceLabel, canSubmitPrediction } from '../lib/predictionUtils';
import type { PredictionChoice } from '../lib/predictionTypes';
import { MatchTeamsDisplay, TeamFlag } from '../components/MatchTeamsDisplay';
import {
  applyMatchStatus,
  canShowPredictCta,
  formatMatchDateHeader,
  getMatchDateKey,
  getTodayDateKey,
  isDateToday,
  isMatchToday,
  withComputedMatchStatuses,
} from '../lib/matchUtils';
import { useWorldCupData } from '../hooks/useWorldCupData';

function resolveTeam(
  teams: TeamInfo[],
  teamId?: string,
  fallbackName?: string
): TeamInfo {
  const id = teamId || fallbackName || 'TBD';
  const name = fallbackName || teamId || 'TBD';
  return (
    teams.find((t) => t.id === teamId) ??
    teams.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? {
      id,
      name,
      flag: '🏳️',
      rank: 0,
      introBench: '',
      introBn: '',
      history: '',
      historyBn: '',
      players: [],
    }
  );
}

function formatGroupLabel(match: MatchData): string {
  const group = match.group ?? '';
  if (/^[A-L]$/.test(group)) return `Group ${group}`;
  return match.round ?? (group || 'TBD');
}

function sortMatchesByDate(matchList: MatchData[]): MatchData[] {
  return [...matchList].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}

function groupMatchesByDate(matchList: MatchData[]): [string, MatchData[]][] {
  const byDate = new Map<string, MatchData[]>();
  for (const match of sortMatchesByDate(matchList)) {
    const key = getMatchDateKey(match);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(match);
  }
  return Array.from(byDate.entries());
}

function matchesSearchFilter(match: MatchData, teams: TeamInfo[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const teamA = resolveTeam(teams, match.teamA, match.teamAName);
  const teamB = resolveTeam(teams, match.teamB, match.teamBName);
  const haystack = [
    teamA.name,
    teamB.name,
    match.group,
    `group ${match.group}`,
    match.venue,
    match.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(q);
}

export function MatchesScreen({
  initialMatchId = null,
  onInitialMatchHandled,
  onNavigateToProfile,
}: {
  initialMatchId?: string | null;
  onInitialMatchHandled?: () => void;
  onNavigateToProfile?: () => void;
} = {}) {
  const [activeTab, setActiveTab] = useState<'fixtures' | 'groups' | 'points' | 'favorites'>('fixtures');
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { matches, teams, groups, standings, isLoading, loadError } = useWorldCupData();

  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(() => {
    const saved = localStorage.getItem('autoconFavoriteTeams');
    return saved ? JSON.parse(saved) : [];
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const liveMatches = useMemo(() => {
    void tick;
    return withComputedMatchStatuses(matches);
  }, [matches, tick]);

  const todayDateKey = useMemo(() => {
    void tick;
    return getTodayDateKey();
  }, [tick]);

  const matchesDataKey = useMemo(
    () => matches.map((m) => `${m.id}:${m.scoreA}:${m.scoreB}:${m.time}`).join('|'),
    [matches]
  );

  const filteredMatches = useMemo(
    () => liveMatches.filter((match) => matchesSearchFilter(match, teams, searchQuery)),
    [liveMatches, teams, searchQuery]
  );

  const hasTodaySection = useMemo(
    () => filteredMatches.some((match) => isMatchToday(match)),
    [filteredMatches, todayDateKey]
  );

  const scrollToTodaySection = useCallback(() => {
    const el = document.getElementById('matches-section-today');
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
    return true;
  }, []);

  const pendingScrollRef = useRef(false);

  useEffect(() => {
    if (!isLoading) {
      pendingScrollRef.current = true;
    }
  }, [matchesDataKey, isLoading]);

  useEffect(() => {
    if (
      !pendingScrollRef.current ||
      isLoading ||
      activeTab !== 'fixtures' ||
      initialMatchId ||
      selectedMatch ||
      !hasTodaySection
    ) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const attemptScroll = () => {
      if (scrollToTodaySection()) {
        pendingScrollRef.current = false;
        return true;
      }
      return false;
    };

    const frame = requestAnimationFrame(() => {
      if (!attemptScroll()) {
        timeout = setTimeout(attemptScroll, 100);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [
    isLoading,
    activeTab,
    initialMatchId,
    selectedMatch,
    hasTodaySection,
    matchesDataKey,
    scrollToTodaySection,
  ]);

  useEffect(() => {
    if (!initialMatchId || liveMatches.length === 0) return;
    const match = liveMatches.find((m) => m.id === initialMatchId);
    if (match) {
      setSelectedMatch(match);
      setActiveTab('fixtures');
      onInitialMatchHandled?.();
    }
  }, [initialMatchId, liveMatches, onInitialMatchHandled]);

  const getTeam = (id: string, fallbackName?: string) => resolveTeam(teams, id, fallbackName);

  const favoriteTeamMatches = liveMatches.filter((match) => {
    if (!favoriteTeams.length) return false;
    return favoriteTeams.includes(match.teamA) || favoriteTeams.includes(match.teamB);
  });

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      teams: group.teams.filter((team) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          team.name.toLowerCase().includes(q) ||
          `group ${group.name}`.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((group) => group.teams.length > 0 || `group ${group.name}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  const toggleFavoriteTeam = (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    const updated = favoriteTeams.includes(teamId)
      ? favoriteTeams.filter((id) => id !== teamId)
      : [...favoriteTeams, teamId];
    setFavoriteTeams(updated);
    localStorage.setItem('autoconFavoriteTeams', JSON.stringify(updated));
  };

  useEffect(() => {
    if (!selectedMatch) return;
    const updated = matches.find((m) => m.id === selectedMatch.id);
    if (updated) setSelectedMatch(updated);
  }, [matches, selectedMatch?.id]);

  if (selectedMatch) {
    return (
      <MatchDetails
        match={selectedMatch}
        teams={teams}
        favoriteTeams={favoriteTeams}
        onToggleFavoriteTeam={toggleFavoriteTeam}
        onBack={() => setSelectedMatch(null)}
      />
    );
  }

  const renderMatchCard = (match: MatchData, inTodaySection = false) => {
    const teamA = resolveTeam(teams, match.teamA, match.teamAName);
    const teamB = resolveTeam(teams, match.teamB, match.teamBName);
    const showPredictCta = canShowPredictCta(match);
    const isLive = match.status === 'live';
    const isToday = inTodaySection || isMatchToday(match);

    return (
      <div
        key={match.id}
        onClick={() => setSelectedMatch(match)}
        className={`text-left shadow-sm rounded-2xl p-4 active:scale-95 transition-transform cursor-pointer relative border ${
          isToday
            ? 'bg-white border-indigo-200 ring-1 ring-indigo-100/80'
            : 'bg-white border-gray-100'
        }`}
      >
        <div className="flex justify-between items-center text-xs text-gray-500 font-medium mb-3">
          <span className="font-semibold text-indigo-700">
            {format(new Date(match.time), 'h:mm a')}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {formatGroupLabel(match)}
            {match.venue ? ` · ${match.venue}` : ''}
          </span>
        </div>

        <MatchTeamsDisplay
          teamA={teamA}
          teamB={teamB}
          match={match}
          teamAAccessory={
            <button
              type="button"
              onClick={(e) => toggleFavoriteTeam(e, teamA.id)}
              className="absolute -top-1 -right-1 p-1 text-gray-300 hover:text-amber-400 z-10"
              aria-label={`Favorite ${teamA.name}`}
            >
              <Star className={`w-4 h-4 ${favoriteTeams.includes(teamA.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          }
          teamBAccessory={
            <button
              type="button"
              onClick={(e) => toggleFavoriteTeam(e, teamB.id)}
              className="absolute -top-1 -right-1 p-1 text-gray-300 hover:text-amber-400 z-10"
              aria-label={`Favorite ${teamB.name}`}
            >
              <Star className={`w-4 h-4 ${favoriteTeams.includes(teamB.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          }
        />

          {showPredictCta && (
             <div className="mt-4 pt-4 border-t border-gray-50 text-center text-sm font-medium text-indigo-600">
                Tap to Predict & Read Preview
             </div>
          )}
          {isLive && (
             <div className="mt-4 pt-4 border-t border-gray-50 text-center text-sm font-medium text-gray-500">
                Match in progress — tap for details
             </div>
          )}
      </div>
    );
  };

  const renderMatchListByDate = (matchList: MatchData[]) => {
    if (matchList.length === 0) {
      const emptyMsg = activeTab === 'favorites'
        ? 'No matches for your favorite teams yet. Star teams from match cards or the Teams screen.'
        : `No matches found matching "${searchQuery}"`;
      return (
        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-2xl border border-gray-100">
          {emptyMsg}
        </div>
      );
    }

    return groupMatchesByDate(matchList).map(([dateKey, dayMatches]) => {
      const isTodaySection = isDateToday(dateKey);
      const liveCount = dayMatches.filter((m) => m.status === 'live').length;

      return (
        <section
          key={dateKey}
          id={isTodaySection ? 'matches-section-today' : undefined}
          tabIndex={isTodaySection ? 0 : undefined}
          aria-label={isTodaySection ? "Today's matches" : formatMatchDateHeader(dateKey)}
          className={`space-y-3 scroll-mt-3 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-2xl ${
            isTodaySection
              ? 'bg-indigo-50/60 border border-indigo-100 p-3 -mx-1 shadow-sm'
              : ''
          }`}
        >
          <div
            className={`sticky top-0 z-10 backdrop-blur-sm py-2 px-1 -mx-1 ${
              isTodaySection ? 'bg-indigo-50/95' : 'bg-gray-50/95'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-gray-900">{formatMatchDateHeader(dateKey)}</h3>
                  {isTodaySection && (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                      Today
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {dayMatches.length} match{dayMatches.length !== 1 ? 'es' : ''}
                </p>
              </div>
              {isTodaySection && (
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-lg shrink-0">
                  {liveCount > 0 ? `${liveCount} live` : 'Scheduled'}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {dayMatches.map((match) => renderMatchCard(match, isTodaySection))}
          </div>
        </section>
      );
    });
  };

  return (
    <div className="pb-24 pt-6 flex flex-col h-screen overflow-hidden">
      {/* <div className="px-4 mb-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matches</h1>
          <p className="text-gray-500 text-sm mt-1">Upcoming Match Schedule & Results</p>
          <p className="text-gray-400 text-xs mt-0.5">আসন্ন খেলার সময়সূচী ও ফলাফল</p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50"
          aria-label="Refresh matches"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div> */}

      <div className="px-4 mb-4 shrink-0">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search teams or groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm sm:text-sm"
          />
        </div>
      </div>

      <div className="flex px-4 gap-2 mb-4 shrink-0 overflow-x-auto hide-scrollbar">
        {['fixtures', 'groups', 'points', 'favorites'].map((t) => (
           <button 
             key={t}
             onClick={() => setActiveTab(t as any)}
             className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap capitalize transition-colors ${activeTab === t ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'}`}
           >
             {t === 'fixtures' ? 'Fixtures' : t === 'groups' ? 'Groups' : t === 'points' ? 'Points Table' : 'Favorites'}
           </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {loadError && (
          <div className="mb-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p>{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-indigo-600 font-medium text-xs mt-1 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isLoading && matches.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm animate-pulse">
            Loading World Cup fixtures and results...
          </div>
        ) : (
          <>
            {activeTab === 'fixtures' && (
              <div className="space-y-6">
                {renderMatchListByDate(filteredMatches)}
              </div>
            )}

            {activeTab === 'favorites' && (
              <div className="space-y-6">
                {favoriteTeams.length > 0 && (
                  <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <h3 className="font-bold text-gray-800 text-sm mb-3">Favorite Teams</h3>
                    <div className="flex flex-wrap gap-2">
                      {favoriteTeams.map((teamId) => {
                        const team = resolveTeam(teams, teamId);
                        return (
                          <button
                            key={teamId}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteTeam(e, teamId);
                            }}
                            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-xs font-semibold"
                          >
                            <TeamFlag team={team} size="sm" />
                            {team.name}
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {renderMatchListByDate(
                  favoriteTeamMatches.filter((m) => matchesSearchFilter(m, teams, searchQuery))
                )}
              </div>
            )}

            {activeTab === 'points' && (
              <GroupPointTable teams={teams} standings={standings} isLoading={isLoading} />
            )}

            {activeTab === 'groups' && (
              <div className="space-y-4">
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-2xl border border-gray-100">
                    {searchQuery
                      ? `No groups or teams found matching "${searchQuery}"`
                      : 'No group data available from the API yet.'}
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.name} className="bg-white border rounded-xl p-6 shadow-sm">
                      <h3 className="font-bold text-gray-800 pb-2 border-b">Group {group.name}</h3>
                      <ul className="text-left mt-4 space-y-3 text-sm font-medium">
                        {group.teams.map((team) => (
                          <li key={team.id} className="flex items-center gap-3">
                            <TeamFlag team={team} size="sm" />
                            {team.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------
// Match Details Component Inside Same File
// ---------------------------------------------
function MatchDetails({
  match: initialMatch,
  teams,
  favoriteTeams,
  onToggleFavoriteTeam,
  onBack,
  onNavigateToProfile,
}: {
  match: MatchData;
  teams: TeamInfo[];
  favoriteTeams: string[];
  onToggleFavoriteTeam: (e: React.MouseEvent, teamId: string) => void;
  onBack: () => void;
  onNavigateToProfile?: () => void;
}) {
  const { user, isAdmin, isAuthReady } = useAuth();
  const [predictionRefreshKey, setPredictionRefreshKey] = useState(0);
  const { prediction: savedPrediction, isLoading: predictionLoading } = useUserPrediction(
    initialMatch.id,
    user?.uid ?? null,
    predictionRefreshKey
  );
  const { match: firestoreMatch, isLoading: matchLoading, error: matchLoadError } = useMatchDocument(
    initialMatch.id,
    teams
  );

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const liveMatch = useMemo(() => {
    const base = firestoreMatch ?? initialMatch;
    return applyMatchStatus(base);
  }, [firestoreMatch, initialMatch, tick]);

  const teamA = resolveTeam(teams, liveMatch.teamA, liveMatch.teamAName);
  const teamB = resolveTeam(teams, liveMatch.teamB, liveMatch.teamBName);

  const [pendingChoice, setPendingChoice] = useState<PredictionChoice | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [predictionSaving, setPredictionSaving] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [predictionSuccess, setPredictionSuccess] = useState(false);
  const [adminScore1, setAdminScore1] = useState('');
  const [adminScore2, setAdminScore2] = useState('');
  const [adminWinner, setAdminWinner] = useState<'team1' | 'team2' | 'draw'>('team1');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSaveError, setAdminSaveError] = useState<string | null>(null);
  const [adminSaveSuccess, setAdminSaveSuccess] = useState(false);

  const team1Name = liveMatch.teamAName ?? teamA.name;
  const team2Name = liveMatch.teamBName ?? teamB.name;

  useEffect(() => {
    setAdminScore1(liveMatch.scoreA !== null ? String(liveMatch.scoreA) : '');
    setAdminScore2(liveMatch.scoreB !== null ? String(liveMatch.scoreB) : '');

    if (liveMatch.winner === team1Name) {
      setAdminWinner('team1');
    } else if (liveMatch.winner === team2Name) {
      setAdminWinner('team2');
    } else if (
      liveMatch.winner === 'Draw' ||
      (liveMatch.scoreA !== null &&
        liveMatch.scoreB !== null &&
        liveMatch.scoreA === liveMatch.scoreB)
    ) {
      setAdminWinner('draw');
    } else if (
      liveMatch.scoreA !== null &&
      liveMatch.scoreB !== null &&
      liveMatch.scoreA > liveMatch.scoreB
    ) {
      setAdminWinner('team1');
    } else if (
      liveMatch.scoreA !== null &&
      liveMatch.scoreB !== null &&
      liveMatch.scoreB > liveMatch.scoreA
    ) {
      setAdminWinner('team2');
    }
  }, [
    liveMatch.id,
    liveMatch.scoreA,
    liveMatch.scoreB,
    liveMatch.winner,
    team1Name,
    team2Name,
  ]);

  const saveAdminResult = async () => {
    const score1 = Number(adminScore1);
    const score2 = Number(adminScore2);
    if (!Number.isInteger(score1) || score1 < 0 || !Number.isInteger(score2) || score2 < 0) {
      setAdminSaveError('Enter valid non-negative whole numbers for both scores.');
      return;
    }

    const winner =
      adminWinner === 'team1' ? team1Name : adminWinner === 'team2' ? team2Name : null;

    if (adminWinner === 'team1' && score1 <= score2) {
      setAdminSaveError(`${team1Name} cannot win with a lower or equal score.`);
      return;
    }
    if (adminWinner === 'team2' && score2 <= score1) {
      setAdminSaveError(`${team2Name} cannot win with a lower or equal score.`);
      return;
    }
    if (adminWinner === 'draw' && score1 !== score2) {
      setAdminSaveError('Draw requires equal scores for both teams.');
      return;
    }

    setAdminSaving(true);
    setAdminSaveError(null);
    setAdminSaveSuccess(false);
    try {
      await updateMatchResultInFirestore(liveMatch.id, score1, score2, winner);
      setAdminSaveSuccess(true);
    } catch (e) {
      console.error(e);
      setAdminSaveError(
        e instanceof Error ? e.message : 'Failed to save match result. Check admin sign-in and Firestore rules.'
      );
    } finally {
      setAdminSaving(false);
    }
  };

  const canPredict = canSubmitPrediction(liveMatch);
  const activeChoice = savedPrediction?.choice ?? null;

  const handleSelectPrediction = (choice: PredictionChoice) => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    if (!canPredict || savedPrediction?.processed) return;
    setPendingChoice(choice);
    setPredictionError(null);
    setPredictionSuccess(false);
  };

  const confirmPrediction = async () => {
    if (!user || !pendingChoice) return;

    setPredictionSaving(true);
    setPredictionError(null);
    try {
      await submitPrediction(liveMatch.id, pendingChoice);
      setPendingChoice(null);
      setPredictionSuccess(true);
      setPredictionRefreshKey((key) => key + 1);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Failed to save prediction.';
      setPredictionError(
        message.includes('permission')
          ? 'Could not save prediction. Ensure the server has Firestore Admin access (serviceAccountKey.json).'
          : message
      );
    } finally {
      setPredictionSaving(false);
    }
  };

  const handleShareMatch = async () => {
    let text = `Check out the match: ${teamA?.name} vs ${teamB?.name} at the Sports SUST Prediction Challenge 26!`;
    if (liveMatch.status === 'completed') {
        text = `Match Finished: ${teamA?.name} ${liveMatch.scoreA} - ${liveMatch.scoreB} ${teamB?.name}. See the results on Sports SUST Prediction Challenge 26!`;
    } else if (activeChoice) {
        const choiceName = choiceLabel(activeChoice, teamA.name, teamB.name);
        text = `I predicted ${choiceName} for the ${teamA?.name} vs ${teamB?.name} match! Join me in the Prediction Challenge 26!`;
    }
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: `${teamA?.name} vs ${teamB?.name} - World Cup 2026`,
                text: text,
                url: window.location.href,
            });
        } catch (err) {
             console.error('Share failed:', err);
        }
    } else {
        await navigator.clipboard.writeText(text + " " + window.location.href);
        alert('Match info copied to clipboard!');
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-24 h-[100vh] overflow-y-auto w-full absolute top-0 left-0 z-10">
      <div className="bg-white px-4 py-4 sticky top-0 border-b border-gray-100 flex items-center justify-between z-20">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-50 rounded-full">
             <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <span className="font-semibold text-lg ml-2 text-gray-900">Match Details</span>
        </div>
        <button onClick={handleShareMatch} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-95 transition-all shadow-sm border border-indigo-100">
           <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {matchLoading && (
          <p className="text-sm text-gray-500 text-center animate-pulse">Loading match from Firestore...</p>
        )}
        {matchLoadError && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{matchLoadError}</p>
          </div>
        )}

        {/* Scorecard */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <MatchTeamsDisplay
            teamA={teamA}
            teamB={teamB}
            match={liveMatch}
            size="lg"
            teamAAccessory={
              <button onClick={(e) => onToggleFavoriteTeam(e, teamA.id)} className="text-gray-300 hover:text-amber-400">
                <Star className={`w-5 h-5 ${favoriteTeams.includes(teamA.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
            }
            teamBAccessory={
              <button onClick={(e) => onToggleFavoriteTeam(e, teamB.id)} className="text-gray-300 hover:text-amber-400">
                <Star className={`w-5 h-5 ${favoriteTeams.includes(teamB.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
            }
          />
          {liveMatch.venue && (
            <p className="text-xs text-gray-500 text-center mt-4">{liveMatch.venue}</p>
          )}

          {isAuthReady && isAdmin && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-gray-900">Admin — Update Result</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="text-xs font-medium text-gray-600">
                  {teamA.name} score
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={adminScore1}
                    onChange={(e) => setAdminScore1(e.target.value)}
                    className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-gray-600">
                  {teamB.name} score
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={adminScore2}
                    onChange={(e) => setAdminScore2(e.target.value)}
                    className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-600 mb-3">
                Winner
                <select
                  value={adminWinner}
                  onChange={(e) => setAdminWinner(e.target.value as 'team1' | 'team2' | 'draw')}
                  className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="team1">{team1Name}</option>
                  <option value="team2">{team2Name}</option>
                  <option value="draw">Draw</option>
                </select>
              </label>
              <button
                type="button"
                onClick={saveAdminResult}
                disabled={adminSaving}
                className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-xl hover:bg-indigo-700 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {adminSaving ? 'Saving to Firestore...' : 'Save Result'}
              </button>
              {adminSaveSuccess && (
                <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  Result saved. All users will see the update in real time.
                </p>
              )}
              {adminSaveError && (
                <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {adminSaveError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Prediction Builder */}
        {(canPredict || savedPrediction) && (
          <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-lg shadow-indigo-100/50">
             <h3 className="font-bold text-gray-900 mb-1">Make your Prediction</h3>
             <p className="text-xs text-gray-500 mb-4 font-medium">
               সঠিক উত্তরের জন্য +১০ পয়েন্ট, ভুলের জন্য -৫ (Submit early!)
             </p>

             {predictionLoading ? (
               <p className="text-sm text-gray-500 text-center py-4 animate-pulse">Loading your prediction...</p>
             ) : (
               <>
                 {savedPrediction && (
                   <div className="mb-4 text-xs rounded-xl px-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-900">
                     Your pick: <span className="font-bold">{choiceLabel(savedPrediction.choice, teamA.name, teamB.name)}</span>
                     {savedPrediction.processed && savedPrediction.pointsAwarded !== null && (
                       <span className={`ml-2 font-bold ${savedPrediction.pointsAwarded > 0 ? 'text-green-700' : 'text-red-600'}`}>
                         ({savedPrediction.pointsAwarded > 0 ? '+' : ''}{savedPrediction.pointsAwarded} pts)
                       </span>
                     )}
                   </div>
                 )}

                 {canPredict && !savedPrediction?.processed && (
                   <div className="grid grid-cols-3 gap-2">
                     <PredictOption
                       label={teamA.name}
                       active={activeChoice === 'team1' || pendingChoice === 'team1'}
                       onClick={() => handleSelectPrediction('team1')}
                     />
                     <PredictOption
                       label="Draw"
                       active={activeChoice === 'draw' || pendingChoice === 'draw'}
                       onClick={() => handleSelectPrediction('draw')}
                     />
                     <PredictOption
                       label={teamB.name}
                       active={activeChoice === 'team2' || pendingChoice === 'team2'}
                       onClick={() => handleSelectPrediction('team2')}
                     />
                   </div>
                 )}

                 {!user && isAuthReady && canPredict && (
                   <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                     Sign in to submit your prediction.
                   </p>
                 )}

                 {predictionSuccess && (
                   <p className="mt-3 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                     Prediction saved successfully!
                   </p>
                 )}
                 {predictionError && (
                   <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                     {predictionError}
                   </p>
                 )}
               </>
             )}
          </div>
        )}

        {pendingChoice && (
          <PredictionConfirmDialog
            choiceLabel={choiceLabel(pendingChoice, teamA.name, teamB.name)}
            isSaving={predictionSaving}
            onCancel={() => setPendingChoice(null)}
            onConfirm={confirmPrediction}
          />
        )}

        {showLoginPrompt && (
          <LoginPromptDialog
            onCancel={() => setShowLoginPrompt(false)}
            onLogin={() => {
              setShowLoginPrompt(false);
              onNavigateToProfile?.();
            }}
          />
        )}

      </div>
    </div>
  )
}

function PredictOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 px-2 rounded-xl border text-sm font-semibold transition-all shadow-sm active:scale-95 ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}
    >
      {label}
    </button>
  );
}

function PredictionConfirmDialog({
  choiceLabel: pick,
  isSaving,
  onConfirm,
  onCancel,
}: {
  choiceLabel: string;
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Prediction</h3>
        <p className="text-sm text-gray-600 mb-6">
          Submit <span className="font-semibold text-indigo-700">{pick}</span> for this match?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginPromptDialog({
  onLogin,
  onCancel,
}: {
  onLogin: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Sign in required</h3>
        <p className="text-sm text-gray-600 mb-6">
          Please sign in with Google to submit your match prediction.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700"
          >
            Go to Profile
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupPointTable({
  teams,
  standings,
  isLoading,
}: {
  teams: TeamInfo[];
  standings: GroupStanding[];
  isLoading: boolean;
}) {
  const groupedStandings = standings.reduce<Record<string, GroupStanding[]>>((acc, row) => {
    const key = row.group || 'Overall';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {isLoading && standings.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm animate-pulse">Loading standings...</div>
      ) : standings.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-2xl border border-gray-100">
          No standings data available from the API yet.
        </div>
      ) : (
        Object.entries(groupedStandings).map(([groupName, rows]) => (
          <div key={groupName} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">
                {groupName === 'Overall' ? 'World Cup Standings' : `Group ${groupName}`}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-white border-b border-gray-50 font-medium uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Team</th>
                <th className="px-2 py-3 text-center">MP</th>
                <th className="px-2 py-3 text-center">GF</th>
                <th className="px-2 py-3 text-center">GD</th>
                <th className="px-4 py-3 text-center text-indigo-600 font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row) => {
                    const team = teams.find((t) => t.id === row.teamId) ?? {
                      id: row.teamId,
                      name: row.teamName,
                      flag: '🏳️',
                      badgeUrl: row.badgeUrl,
                      rank: row.rank,
                      introBench: '',
                      introBn: '',
                      history: '',
                      historyBn: '',
                      players: [],
                    };
                    return (
                      <tr key={row.teamId} className="bg-white hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 flex items-center gap-2">
                          <TeamFlag team={team} size="sm" />
                          <span className="font-semibold text-gray-900 text-xs sm:text-sm">{team.name}</span>
                        </td>
                        <td className="px-2 py-3 text-center text-gray-600 font-medium">{row.mp}</td>
                        <td className="px-2 py-3 text-center text-gray-600 font-medium">{row.gf}</td>
                        <td className="px-2 py-3 text-center text-gray-600 font-medium">{row.gd}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600 text-base">{row.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      <p className="text-xs text-center text-gray-400 mt-4 px-4 leading-relaxed">
        * This section automatically updates via Google Search results after matches conclude. <br />
        (ম্যাচ শেষে গুগলের সাহায্যে পয়েন্ট টেবিল নিজে থেকেই আপডেট হবে)
      </p>
    </div>
  );
}
