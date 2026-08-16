import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/screens/Dashboard';
import { Notes } from '@/screens/Notes';
import { Tasks } from '@/screens/Tasks';
import { CalendarView } from '@/screens/CalendarView';
import { Goals } from '@/screens/Goals';
import { Documents } from '@/screens/Documents';
import { Expenses } from '@/screens/Expenses';
import { Reminders } from '@/screens/Reminders';
import { MemoryView } from '@/screens/MemoryView';
import { GlobalSearch } from '@/screens/GlobalSearch';
import { AIAssistant } from '@/screens/AIAssistant';
import { Settings } from '@/screens/Settings';
import { useAutomation } from '@/hooks/useAutomation';
import type { ViewKey } from '@/lib/types';

function AppContent() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<ViewKey>('dashboard');

  useAutomation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar current={view} onNavigate={setView} />
      <main className="flex-1 overflow-y-auto p-4 pt-16 md:p-6 md:pt-6">
        <div className="mx-auto max-w-6xl animate-fade-in">
          {view === 'dashboard' && <Dashboard onNavigate={setView} />}
          {view === 'notes' && <Notes />}
          {view === 'tasks' && <Tasks />}
          {view === 'calendar' && <CalendarView />}
          {view === 'goals' && <Goals />}
          {view === 'documents' && <Documents />}
          {view === 'expenses' && <Expenses />}
          {view === 'reminders' && <Reminders />}
          {view === 'memory' && <MemoryView />}
          {view === 'search' && <GlobalSearch onNavigate={setView} />}
          {view === 'ai' && <AIAssistant />}
          {view === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
