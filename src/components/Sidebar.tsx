import { useState } from 'react';
import {
  LayoutDashboard,
  StickyNote,
  CheckSquare,
  Calendar,
  Target,
  FileText,
  DollarSign,
  Bell,
  Brain,
  Search,
  Bot,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import type { ViewKey } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'expenses', label: 'Expenses', icon: DollarSign },
  { key: 'reminders', label: 'Reminders', icon: Bell },
  { key: 'memory', label: 'Memory', icon: Brain },
  { key: 'search', label: 'Search', icon: Search },
  { key: 'ai', label: 'AI Assistant', icon: Bot },
  { key: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  current: ViewKey;
  onNavigate: (v: ViewKey) => void;
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (v: ViewKey) => {
    onNavigate(v);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Life OS</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Personal Productivity</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={cn(
                'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-white' : '')} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-700">
        <button
          onClick={toggleTheme}
          className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
            <span className="text-xs font-bold">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
              {user?.email ?? 'Unknown'}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-white px-4 py-3 shadow-sm dark:bg-gray-800 md:hidden">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <span className="font-bold text-gray-900 dark:text-gray-100">Life OS</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-600 dark:text-gray-400">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
