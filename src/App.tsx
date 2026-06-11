import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { DashboardScreen } from './screens/DashboardScreen';
import { MatchesScreen } from './screens/MatchesScreen';
import { TeamsScreen } from './screens/TeamsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { Moon, Sun, Languages } from 'lucide-react';
import { Footer } from './components/Footer';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from './lib/i18n';
import { useAuth } from './hooks/useAuth';
import { useAutoScorePredictions } from './hooks/useAutoScorePredictions';

export default function App() {
  const { isAdmin, isAuthReady } = useAuth();
  useAutoScorePredictions(isAdmin, isAuthReady);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);

  const handleNavigate = (tab: string, matchId?: string) => {
    setCurrentTab(tab);
    setPendingMatchId(matchId ?? null);
  };
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { t, language, setLanguage } = useI18n();

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'bn' : 'en');
  };

  const renderScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardScreen onNavigate={handleNavigate} />;
      case 'matches':
        return (
          <MatchesScreen
            initialMatchId={pendingMatchId}
            onInitialMatchHandled={() => setPendingMatchId(null)}
            onNavigateToProfile={() => setCurrentTab('profile')}
          />
        );
      case 'teams':
        return <TeamsScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <DashboardScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 font-sans sm:bg-gray-200 flex justify-center transition-colors">
      <div className="w-full max-w-md bg-gray-50 min-h-screen shadow-2xl relative overflow-hidden flex flex-col transition-colors">
        {/* Top App Bar */}
        <header className="bg-white border-b border-gray-100 flex items-center py-4 px-4 shrink-0 z-10 sticky top-0 transition-colors">
          <div className="flex-1">
             <button onClick={toggleLanguage} className="p-2 text-gray-500 hover:text-indigo-600 transition-colors rounded-full relative active:scale-95 flex items-center gap-1 font-bold text-xs uppercase cursor-pointer">
                <Languages className="w-4 h-4" />
                {language}
             </button>
          </div>
          <div className="flex flex-col items-center flex-2">
             <h1 className="font-black text-indigo-900 text-lg tracking-tight uppercase">{t('app.title')}</h1>
             <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-tight">{t('app.subtitle')}</p>
             <p className="text-[8px] uppercase font-bold text-indigo-400 tracking-widest mt-1">{t('app.powered_by')}</p>
          </div>
          <div className="flex-1 flex justify-end">
             <button onClick={toggleTheme} className="p-2 text-gray-500 hover:text-indigo-600 transition-colors rounded-full relative active:scale-95 cursor-pointer">
                {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
             </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 flex flex-col w-full h-full overflow-hidden absolute inset-0"
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </div>
        
        <div className="absolute bottom-[4.5rem] left-0 right-0 z-0 pointer-events-none">
          <Footer />
        </div>

        <Navigation currentTab={currentTab} setTab={setCurrentTab} />
      </div>
    </div>
  );
}
