import { useCallback, useEffect, useState } from 'react';
import { TeamInfo } from '../types';
import { ChevronRight, ChevronLeft, MapPin, Users2, Award, Star, AlertCircle, RefreshCw } from 'lucide-react';

export function TeamsScreen() {
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selected, setSelected] = useState<TeamInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(() => {
    const saved = localStorage.getItem('autoconFavoriteTeams');
    return saved ? JSON.parse(saved) : [];
  });

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || 'Failed to load teams.');
        return;
      }
      setTeams(data);
    } catch (e) {
      console.error(e);
      setLoadError('Network error. Could not load teams.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const toggleFavorite = (teamId: string) => {
    const updated = favoriteTeams.includes(teamId)
      ? favoriteTeams.filter((id) => id !== teamId)
      : [...favoriteTeams, teamId];
    setFavoriteTeams(updated);
    localStorage.setItem('autoconFavoriteTeams', JSON.stringify(updated));
  };

  if (selected) {
    return (
      <div className="bg-gray-50 min-h-screen pb-24 h-[100vh] overflow-y-auto w-full absolute top-0 left-0 z-10">
        <div className="bg-white px-4 py-4 sticky top-0 border-b border-gray-100 flex items-center justify-between shadow-sm z-20">
          <div className="flex items-center">
            <button onClick={() => setSelected(null)} className="p-2 -ml-2">
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <span className="font-bold text-lg ml-2 text-gray-900">{selected.name}</span>
          </div>
          <button
            onClick={() => toggleFavorite(selected.id)}
            className="p-2 text-gray-300 hover:text-amber-400"
          >
            <Star className={`w-5 h-5 ${favoriteTeams.includes(selected.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div className="bg-white rounded-3xl pb-6 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="text-center pt-8">
              <div className="text-6xl mb-4">{selected.flag}</div>
              <h2 className="text-2xl font-black text-gray-900">{selected.name}</h2>
            </div>

            <div className="text-center mt-4 flex flex-wrap justify-center gap-2">
              {selected.group && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                  Group {selected.group}
                </span>
              )}
              {selected.confederation && (
                <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-700 px-3 py-1 rounded-full text-xs font-bold border border-gray-100">
                  {selected.confederation}
                </span>
              )}
            </div>

            <div className="mt-6 px-6 text-left space-y-5">
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Story
                </h4>
                <p className="text-gray-700 text-sm italic">{selected.introBench}</p>
                <p className="text-gray-800 font-medium text-sm mt-2">{selected.introBn}</p>
              </div>
              {selected.qualification && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Qualification (বাছাইপর্ব)
                  </h4>
                  <p className="text-gray-700 text-sm">{selected.qualification}</p>
                </div>
              )}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Award className="w-3 h-3" /> History
                </h4>
                <p className="text-gray-700 text-sm">{selected.history}</p>
                <p className="text-gray-800 font-medium text-sm mt-1">{selected.historyBn}</p>
              </div>
            </div>
          </div>

          {selected.players.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4 ml-1">
                <Users2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-lg text-gray-900">Squad</h3>
              </div>
              <div className="space-y-4">
                {selected.players.map((p, idx) => (
                  <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <img src={p.img} alt={p.name} className="w-16 h-16 rounded-full object-cover border-2 border-indigo-50 shrink-0" />
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{p.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">{p.bio}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-6 flex flex-col h-screen overflow-hidden">
      <div className="px-4 mb-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Participating Teams</h1>
          <p className="text-gray-500 text-sm mt-1">দল ও খেলোয়াড়দের বিস্তারিত প্রোফাইল</p>
        </div>
        <button
          onClick={loadTeams}
          disabled={isLoading}
          className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loadError && (
        <div className="px-4 mb-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mx-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{loadError}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        {isLoading && teams.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm animate-pulse">Loading teams...</div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              onClick={() => setSelected(team)}
              className="bg-white border text-left border-gray-100 shadow-sm rounded-2xl p-4 flex items-center cursor-pointer active:scale-95 transition-transform"
            >
              <span className="text-4xl mr-4">{team.flag}</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">{team.name}</h3>
                <div className="flex gap-2 mt-1">
                  {team.group && (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      Group {team.group}
                    </span>
                  )}
                  {team.confederation && (
                    <span className="text-xs font-medium text-gray-500">{team.confederation}</span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(team.id);
                }}
                className="p-2 mr-1 text-gray-300 hover:text-amber-400"
              >
                <Star className={`w-5 h-5 ${favoriteTeams.includes(team.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
              <ChevronRight className="text-gray-300 w-5 h-5" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
