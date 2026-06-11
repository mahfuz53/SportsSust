import { useState, useEffect } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Zap, Target, History, HelpCircle, Trophy, Clock, AlertCircle, UserCircle, Loader2 } from 'lucide-react';
import { useProfileActivity } from '../hooks/useProfileActivity';
import { User as FirebaseUser, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { getFirebaseAuthErrorMessage, isLikelyUnauthorizedHost } from '../lib/firebaseAuthErrors';
import {
  fetchUserProfile,
  logSignInSuccess,
  saveUserProfile,
  type UserProfileResponse,
} from '../lib/userProfileApi';

function resolveProfilePhotoUrl(
  firebaseUser: FirebaseUser | null,
  userProfile: UserProfileResponse | null
): string | null {
  const url = firebaseUser?.photoURL || userProfile?.photoURL;
  return url?.trim() ? url : null;
}

function ProfileAvatar({
  photoURL,
  displayName,
  sizeClass = 'w-24 h-24',
  iconClass = 'w-12 h-12',
  className = '',
}: {
  photoURL: string | null;
  displayName?: string | null;
  sizeClass?: string;
  iconClass?: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photoURL]);

  const showImage = Boolean(photoURL) && !imageFailed;

  if (showImage) {
    return (
      <img
        src={photoURL!}
        alt={displayName || 'Profile photo'}
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className={`${sizeClass} rounded-full object-cover border-4 border-white shadow-lg ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-indigo-100 flex items-center justify-center border-4 border-white shadow-lg ${className}`}
      aria-label={displayName ? `${displayName} profile` : 'Default profile avatar'}
    >
      <UserCircle className={`${iconClass} text-indigo-400`} strokeWidth={1.5} />
    </div>
  );
}

export function ProfileScreen() {
  const [userId, setUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'profile' | 'help' | 'subscription'>('profile');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileResponse | null>(null);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const showHostWarning = isLikelyUnauthorizedHost();
  const { activity, isLoading: isActivityLoading, error: activityError } = useProfileActivity(
    firebaseUser?.uid
  );

  useEffect(() => {
    let savedId = localStorage.getItem('autoconUserId');
    if (!savedId) {
      // Generate a unique Autonumber User ID: AUTOCON-XXXX
      const randomNumber = Math.floor(1000 + Math.random() * 9000);
      savedId = `AUTOCON-${randomNumber}`;
      localStorage.setItem('autoconUserId', savedId);
    }
    setUserId(savedId);

    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setFirebaseUser(u);
      if (!u) {
        setUserProfile(null);
        setIsSubscriber(false);
        return;
      }

      try {
        await auth.authStateReady();
        const profile = await fetchUserProfile(u);
        setUserProfile(profile);
        setIsSubscriber(Boolean(profile?.isSubscriber));
        setAuthError(null);
      } catch (e) {
        console.error(e);
        setAuthError(getFirebaseAuthErrorMessage(e));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const profile = await saveUserProfile(result.user, { isSubscriber: true });
      logSignInSuccess(result.user, profile);
      setFirebaseUser(result.user);
      setUserProfile(profile);
      setIsSubscriber(profile.isSubscriber);
    } catch (e) {
      console.error(e);
      setAuthError(getFirebaseAuthErrorMessage(e));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const totalScore = activity?.totalScore ?? 0;
  const matchesPredicted = activity?.matchesPredicted ?? 0;
  const leaderboardRank = activity?.leaderboardRank;
  const totalPlayers = activity?.totalPlayers ?? 0;

  const chartData = (activity?.scoringHistory ?? []).map((point) => ({
    match: point.label,
    points: point.cumulativeScore,
  }));

  const pastPredictions = activity?.pastPredictions ?? [];

  const getTierInfo = (score: number) => {
    const tiers = [
      { name: 'Bronze', min: 0, max: 100, color: 'from-orange-400 to-amber-500', text: 'text-amber-600', bg: 'bg-orange-50' },
      { name: 'Silver', min: 100, max: 300, color: 'from-gray-300 to-gray-400', text: 'text-gray-600', bg: 'bg-gray-100' },
      { name: 'Gold', min: 300, max: 600, color: 'from-yellow-400 to-amber-500', text: 'text-yellow-600', bg: 'bg-yellow-50' },
      { name: 'Platinum', min: 600, max: 1000, color: 'from-teal-400 to-cyan-500', text: 'text-cyan-600', bg: 'bg-cyan-50' },
      { name: 'Diamond', min: 1000, max: Infinity, color: 'from-indigo-400 to-purple-500', text: 'text-purple-600', bg: 'bg-purple-50' }
    ];

    const currentTierIndex = Math.max(0, tiers.findIndex(t => score >= t.min && score < t.max));
    const currentTier = tiers[currentTierIndex !== -1 ? currentTierIndex : tiers.length - 1];
    const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

    let progress = 100;
    if (nextTier) {
      progress = ((score - currentTier.min) / (currentTier.max - currentTier.min)) * 100;
    }

    return { currentTier, nextTier, progress };
  };

  const { currentTier, nextTier, progress } = getTierInfo(totalScore);
  const profilePhotoURL = resolveProfilePhotoUrl(firebaseUser, userProfile);
  const profileDisplayName =
    firebaseUser?.displayName || userProfile?.displayName || null;

  return (
    <div className="pb-24 pt-6 flex flex-col h-screen overflow-hidden">
      <div className="px-4 mb-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {firebaseUser && (
            <ProfileAvatar
              photoURL={profilePhotoURL}
              displayName={profileDisplayName}
              sizeClass="w-12 h-12"
              iconClass="w-7 h-7"
              className="border-2 shrink-0"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <p className="text-gray-500 text-sm mt-1">আপনার পারফরম্যান্স ও তথ্য</p>
          </div>
        </div>
      </div>

      <div className="flex px-4 gap-2 mb-4 shrink-0">
         <button 
           onClick={() => setActiveTab('profile')}
           className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'profile' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'}`}
         >
           My Activity
         </button>
         <button 
           onClick={() => setActiveTab('help')}
           className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${activeTab === 'help' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'}`}
         >
           <HelpCircle className="w-4 h-4" /> Help & Info
         </button>
         <button 
           onClick={() => setActiveTab('subscription')}
           className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${activeTab === 'subscription' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'}`}
         >
           <Zap className="w-4 h-4" /> Subscription
         </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {activeTab === 'profile' && (
          <>
            {!firebaseUser ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to view your activity</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-xs">
                  Connect your Google account to see your profile, scores, and prediction history.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isAuthLoading}
                  className="w-full max-w-sm bg-white border border-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {isAuthLoading ? 'Connecting...' : 'Sign in with Google'}
                </button>
                <p className="text-xs text-gray-400 mt-4">Challenge ID: {userId}</p>
                {authError && (
                  <p className="mt-4 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 w-full max-w-sm">
                    {authError}
                  </p>
                )}
              </div>
            ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4">
                  <ProfileAvatar
                    photoURL={profilePhotoURL}
                    displayName={profileDisplayName}
                  />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {profileDisplayName || 'Google User'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{firebaseUser.email || userProfile?.email}</p>
                {isSubscriber && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                    <Zap className="w-3.5 h-3.5" /> PRO Subscriber
                  </span>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 text-sm">
                <div className="flex justify-between gap-4 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-gray-500 font-medium">Firebase UID</span>
                  <span className="text-gray-900 font-mono text-xs break-all text-right">{firebaseUser.uid}</span>
                </div>
                <div className="flex justify-between gap-4 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-gray-500 font-medium">Challenge ID</span>
                  <span className="text-gray-900 font-semibold">{userId}</span>
                </div>
                <div className="flex justify-between gap-4 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-gray-500 font-medium">Email verified</span>
                  <span className="text-gray-900 font-semibold">{firebaseUser.emailVerified ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between gap-4 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-gray-500 font-medium">Provider</span>
                  <span className="text-gray-900 font-semibold capitalize">
                    {firebaseUser.providerData[0]?.providerId?.replace('.com', '') ?? 'Google'}
                  </span>
                </div>
              </div>
            </div>
            )}

            {firebaseUser && (
            <>
            {activityError && (
              <div className="mb-4 bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-700">
                {activityError}
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col items-center mb-8 relative">
         <div className="absolute top-4 right-4 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
            ID: {userId}
         </div>

         {isActivityLoading ? (
           <div className="flex flex-col items-center justify-center py-12 w-full text-gray-400">
             <Loader2 className="w-8 h-8 animate-spin mb-2" />
             <span className="text-sm">Loading your stats...</span>
           </div>
         ) : (
           <>
         <div className="grid grid-cols-2 gap-4 w-full mt-2">
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Score</div>
              <div className="text-3xl font-black text-indigo-600">{totalScore}</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Played</div>
              <div className="text-3xl font-black text-gray-900">{matchesPredicted}</div>
            </div>
         </div>

         <div className={`w-full mt-6 rounded-2xl p-5 border border-gray-100 ${currentTier.bg}`}>
            <div className="flex justify-between items-end mb-2">
               <div>
                  <div className="text-[10px] items-center font-bold text-gray-500 uppercase tracking-widest mb-1 flex gap-1">
                     <Target className="w-3 h-3" /> Current Rank
                  </div>
                  <div className="text-xl font-black tracking-tight flex items-center gap-2 text-indigo-700">
                     {leaderboardRank !== null ? (
                       <>#{leaderboardRank}{totalPlayers > 0 && <span className="text-sm font-semibold text-gray-500">of {totalPlayers}</span>}</>
                     ) : (
                       <span className="text-sm font-semibold text-gray-500">Not ranked yet</span>
                     )}
                  </div>
                  <div className={`text-xs font-bold mt-1 ${currentTier.text}`}>{currentTier.name} Tier</div>
               </div>
               {nextTier ? (
                  <div className="text-right">
                     <div className="text-xs text-gray-600 font-medium bg-white/60 px-2 py-1 rounded-lg inline-block">
                        <span className="font-bold text-gray-900">{Math.max(0, nextTier.min - totalScore)}</span> pts to {nextTier.name}
                     </div>
                  </div>
               ) : (
                  <div className="text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                     Max Tier Reached
                  </div>
               )}
            </div>

            <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden mt-3 shadow-inner">
               <div
                 className={`h-full bg-gradient-to-r ${currentTier.color} rounded-full transition-all duration-1000 ease-out relative`}
                 style={{ width: `${Math.max(5, progress)}%` }}
               >
                 <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 w-full h-full animate-pulse"></div>
               </div>
            </div>
         </div>
           </>
         )}
      </div>

      <div>
        <h3 className="font-bold text-gray-900 mb-4 px-1">Scoring History <span className="text-xs font-normal text-gray-500">(ইতিহাস)</span></h3>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 h-[250px] pt-6 pr-6">
          {isActivityLoading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 text-center px-4">
              No scored predictions yet. Your score timeline will appear here after match results are in.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="match" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dx={-10} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
              />
              <Line
                type="linear"
                dataKey="points"
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: '#4f46e5' }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="my-8">
        <h3 className="font-bold text-gray-900 mb-4 px-1 flex items-center gap-2">
           <History className="w-5 h-5 text-indigo-600" />
           Past Predictions
        </h3>
        {isActivityLoading ? (
          <div className="flex justify-center py-8 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : pastPredictions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-sm text-gray-400">
            No predictions yet. Head to Matches to make your first pick.
          </div>
        ) : (
        <div className="space-y-4">
           {pastPredictions.map(pred => {
              const isPending = pred.isCorrect === null;
              const isCorrect = pred.isCorrect === true;
              const statusClass = isPending
                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                : isCorrect
                  ? 'bg-green-50 text-green-600 border border-green-100'
                  : 'bg-red-50 text-red-600 border border-red-100';
              const statusLabel = isPending
                ? 'Pending'
                : isCorrect
                  ? `+${pred.pointsEarned} Ptn • Correct`
                  : `${pred.pointsEarned} Ptn • Incorrect`;

              return (
              <div key={pred.matchId} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                 <div className="flex justify-between items-center text-xs text-gray-500 font-medium mb-4 pb-3 border-b border-gray-50">
                    <span>{pred.matchDate}</span>
                    <span className={`px-2 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${statusClass}`}>
                       {statusLabel}
                    </span>
                 </div>

                 <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col items-center w-5/12">
                      <span className="text-3xl mb-1">{pred.team1Flag}</span>
                      <span className="font-bold text-center text-xs text-gray-900">{pred.team1Name}</span>
                    </div>
                    <div className="w-2/12 text-center flex flex-col items-center">
                      <div className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded w-full">VS</div>
                    </div>
                    <div className="flex flex-col items-center w-5/12">
                      <span className="text-3xl mb-1">{pred.team2Flag}</span>
                      <span className="font-bold text-center text-xs text-gray-900">{pred.team2Name}</span>
                    </div>
                 </div>

                 <div className="text-xs bg-gray-50 rounded-xl p-3 flex justify-between items-center border border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] mb-0.5">Your Prediction</span>
                      <span className="font-bold text-gray-900">{pred.predicted}</span>
                    </div>
                    <div className="w-px h-6 bg-gray-200 mx-2"></div>
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] mb-0.5">Match Result</span>
                      <span className={`font-bold ${isPending ? 'text-gray-500' : isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                        {pred.actual ?? 'Pending'}
                      </span>
                    </div>
                 </div>
              </div>
              );
           })}
        </div>
        )}
      </div>
            </>
            )}
      </>
      )}

      {activeTab === 'help' && (
        <div className="space-y-6 mb-8 mt-2">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-base">
                 <Trophy className="w-5 h-5 text-indigo-600" />
                 কীভাবে পয়েন্ট পাবেন? (How to Score)
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                 প্রতিটি সঠিক প্রেডিকশনের জন্য আপনি <span className="font-bold text-green-600 mb-1">১০ পয়েন্ট</span> পাবেন। ভুল প্রেডিকশনের ক্ষেত্রে <span className="font-bold text-red-500">৫ পয়েন্ট</span> কাটা হবে, তবে কোনো প্রেডিকশন না দিলে কোনো পয়েন্ট যোগ বা বিয়োগ হবে না।
              </p>
           </div>
           
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-base">
                 <Clock className="w-5 h-5 text-amber-500" />
                 প্রেডিকশনের সময়সীমা (Timings)
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                 ম্যাচ শুরুর আধা ঘণ্টা বা ৩০ মিনিট আগে পর্যন্ত প্রেডিকশন জমা দেওয়া এবং পরিবর্তন করা যাবে। একবার ম্যাচ ওই সময়ের মধ্যে চলে এলে প্রেডিকশন লক হয়ে যাবে।
              </p>
           </div>

           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-base">
                 <Target className="w-5 h-5 text-blue-500" />
                 লিডারবোর্ড (Leaderboard)
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                 সর্বোচ্চ পয়েন্ট অর্জনকারী টুর্নামেন্টের বিজয়ী হবেন। পয়েন্ট সমান হলে, যে ইউজার আগে প্রেডিক্ট করেছেন তিনি লিডারবোর্ডে এগিয়ে থাকবেন।
              </p>
           </div>

           <div className="bg-indigo-50 rounded-2xl p-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                কোনো প্রযুক্তিগত সহায়তার জন্য বা বাগ রিপোর্ট করতে আমাদের সোশ্যাল পেইজে ইনবক্স করুন। স্পোর্টস সাস্ট টিমের সিদ্ধান্তই চূড়ান্ত বলে গণ্য হবে।
              </p>
           </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="space-y-6 mb-8 mt-2">
           {showHostWarning && (
             <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
               <p className="text-xs text-amber-900 leading-relaxed">
                 Google sign-in may fail on <span className="font-semibold">{window.location.hostname}</span>.
                 For local dev use <span className="font-semibold">http://localhost:3000</span>, or add this hostname under Firebase Console → Authentication → Authorized domains.
               </p>
             </div>
           )}

           {authError && (
             <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
               <p className="text-xs text-red-900 leading-relaxed">{authError}</p>
             </div>
           )}

           <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
              <div className="mb-4">
                {firebaseUser ? (
                  <ProfileAvatar
                    photoURL={profilePhotoURL}
                    displayName={profileDisplayName}
                    sizeClass="w-16 h-16"
                    iconClass="w-9 h-9"
                  />
                ) : (
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                    <Zap className="w-8 h-8 text-indigo-600" />
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {firebaseUser && profileDisplayName ? profileDisplayName : 'PRO Subscriber'}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Connect your Google account to unlock subscriber perks, save your progress seamlessly, and appear on the global, verified leaderboard.
              </p>
              
              {firebaseUser && isSubscriber ? (
                 <div className="w-full bg-green-50 border border-green-200 text-green-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3">
                    <Zap className="w-5 h-5" />
                    Active PRO Subscriber
                 </div>
              ) : (
                 <button 
                   onClick={handleGoogleLogin}
                   disabled={isAuthLoading}
                   className="w-full bg-white border border-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50"
                 >
                   <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                   </svg>
                   {isAuthLoading ? 'Connecting...' : 'Signup & Connect via Google'}
                 </button>
              )}
           </div>
           
           <div className="bg-indigo-50/50 rounded-2xl p-4 flex gap-3 items-start">
              <div className="bg-white p-2 rounded-lg skeleton-shadow">
                 <History className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                 <h4 className="font-bold text-gray-900 text-sm">Season History</h4>
                 <p className="text-xs text-gray-500 mt-1">Permanent access to your past season predictions.</p>
              </div>
           </div>
        </div>
      )}
      
      </div>
    </div>
  );
}
