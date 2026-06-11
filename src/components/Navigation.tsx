import { Home, Calendar, Users, UserRound } from 'lucide-react';
import { cn } from '../lib/utils';
import { useI18n } from '../lib/i18n';

interface NavigationProps {
  currentTab: string;
  setTab: (tab: string) => void;
}

export function Navigation({ currentTab, setTab }: NavigationProps) {
  const { t } = useI18n();
  const tabs = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: Home },
    { id: 'matches', label: t('nav.matches'), icon: Calendar },
    { id: 'teams', label: t('nav.teams'), icon: Users },
    { id: 'profile', label: t('nav.profile'), icon: UserRound },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
      <div className="max-w-md mx-auto flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center w-full py-3 space-y-1 transition-colors",
                isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
