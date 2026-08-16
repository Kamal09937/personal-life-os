import { useState, useCallback } from 'react';
import { Search as SearchIcon, StickyNote, CheckSquare, Calendar, Target, FileText, DollarSign, Bell, Brain, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { ViewKey } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  view: ViewKey;
}

export function GlobalSearch({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!user || !query.trim()) return;
    setLoading(true);
    setSearched(true);
    const q = query.trim();
    const filter = `title.ilike.%${q}%,description.ilike.%${q}%,content.ilike.%${q}%,tags.ilike.%${q}%`;

    const [notesRes, tasksRes, eventsRes, goalsRes, docsRes, expensesRes, remindersRes, memoriesRes] = await Promise.all([
      supabase.from('notes').select('id,title,content,category').eq('user_id', user.id).or(filter),
      supabase.from('tasks').select('id,title,description,category,status').eq('user_id', user.id).or(filter),
      supabase.from('events').select('id,title,description,event_date').eq('user_id', user.id).or(filter),
      supabase.from('goals').select('id,title,description,progress').eq('user_id', user.id).or(filter),
      supabase.from('documents').select('id,title,category,tags').eq('user_id', user.id).or(filter),
      supabase.from('expenses').select('id,description,category,amount,expense_date').eq('user_id', user.id).or(filter),
      supabase.from('reminders').select('id,title,description,reminder_date').eq('user_id', user.id).or(filter),
      supabase.from('memories').select('id,title,content,category').eq('user_id', user.id).or(filter),
    ]);

    const allResults: SearchResult[] = [
      ...(notesRes.data ?? []).map((n: any) => ({ type: 'Notes', id: n.id, title: n.title || 'Untitled', subtitle: n.content.slice(0, 80), view: 'notes' as ViewKey })),
      ...(tasksRes.data ?? []).map((t: any) => ({ type: 'Tasks', id: t.id, title: t.title, subtitle: t.description?.slice(0, 80) || t.category, view: 'tasks' as ViewKey })),
      ...(eventsRes.data ?? []).map((e: any) => ({ type: 'Events', id: e.id, title: e.title, subtitle: `${formatDate(e.event_date)} ${e.description?.slice(0, 60) ?? ''}`, view: 'calendar' as ViewKey })),
      ...(goalsRes.data ?? []).map((g: any) => ({ type: 'Goals', id: g.id, title: g.title, subtitle: g.description?.slice(0, 80) ?? `${g.progress}% complete`, view: 'goals' as ViewKey })),
      ...(docsRes.data ?? []).map((d: any) => ({ type: 'Documents', id: d.id, title: d.title, subtitle: d.category, view: 'documents' as ViewKey })),
      ...(expensesRes.data ?? []).map((ex: any) => ({ type: 'Expenses', id: ex.id, title: ex.description || ex.category, subtitle: `${formatCurrency(Number(ex.amount))} - ${formatDate(ex.expense_date)}`, view: 'expenses' as ViewKey })),
      ...(remindersRes.data ?? []).map((r: any) => ({ type: 'Reminders', id: r.id, title: r.title, subtitle: `${formatDate(r.reminder_date)} ${r.description?.slice(0, 60) ?? ''}`, view: 'reminders' as ViewKey })),
      ...(memoriesRes.data ?? []).map((m: any) => ({ type: 'Memories', id: m.id, title: m.title, subtitle: m.content.slice(0, 80), view: 'memory' as ViewKey })),
    ];

    setResults(allResults);
    setLoading(false);
  }, [user, query]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const typeIcons: Record<string, typeof SearchIcon> = {
    Notes: StickyNote, Tasks: CheckSquare, Events: Calendar, Goals: Target,
    Documents: FileText, Expenses: DollarSign, Reminders: Bell, Memories: Brain,
  };

  return (
    <div>
      <PageHeader icon={SearchIcon} title="Global Search" description="Search across all your data at once" />

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-11 text-base"
            placeholder="Search for anything... (e.g. 'insurance', 'meeting', 'rent')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          />
        </div>
        <button className="btn-primary" onClick={search} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
      ) : !searched ? (
        <EmptyState icon={SearchIcon} title="Start searching" description="Enter a keyword above to search across notes, tasks, events, goals, documents, expenses, reminders, and memories." />
      ) : results.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No results found" description={`No matches for "${query}". Try a different keyword.`} />
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">{results.length} result(s) for "{query}"</p>
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = typeIcons[type] ?? SearchIcon;
            return (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{type}</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500">({items.length})</span>
                </div>
                <div className="space-y-1">
                  {items.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => onNavigate(r.view)}
                      className="flex w-full items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-left transition-all hover:border-brand-200 hover:bg-brand-50/50 dark:border-gray-700/50 dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
                    >
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{r.subtitle}</p>
                      </div>
                      <span className={cn('badge bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600')}>
                        {r.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
