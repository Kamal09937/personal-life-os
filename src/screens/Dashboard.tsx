import { useEffect, useState } from 'react';
import {
  CheckSquare,
  Calendar as CalIcon,
  Target,
  StickyNote,
  FileText,
  DollarSign,
  Bell,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Task, EventItem, Goal, Note, Expense, Reminder, DocumentItem, ViewKey } from '@/lib/types';
import { formatDate, formatCurrency, isToday, isOverdue, isUpcoming, daysUntil, priorityColor, statusColor, formatStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onNavigate: (v: ViewKey) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadAll = async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [tasksRes, eventsRes, goalsRes, notesRes, expensesRes, remindersRes, docsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
        supabase.from('events').select('*').eq('user_id', user.id).gte('event_date', today).order('event_date', { ascending: true }).limit(10),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active').order('target_date', { ascending: true }),
        supabase.from('notes').select('*').eq('user_id', user.id).eq('archived', false).order('updated_at', { ascending: false }).limit(5),
        supabase.from('expenses').select('*').eq('user_id', user.id).gte('expense_date', monthStartStr).order('expense_date', { ascending: false }),
        supabase.from('reminders').select('*').eq('user_id', user.id).eq('completed', false).gte('reminder_date', today).order('reminder_date', { ascending: true }).limit(5),
        supabase.from('documents').select('*').eq('user_id', user.id).eq('archived', false).order('updated_at', { ascending: false }).limit(5),
      ]);

      if (cancelled) return;
      setTasks(tasksRes.data ?? []);
      setEvents(eventsRes.data ?? []);
      setGoals(goalsRes.data ?? []);
      setNotes(notesRes.data ?? []);
      setExpenses(expensesRes.data ?? []);
      setReminders(remindersRes.data ?? []);
      setDocuments(docsRes.data ?? []);
      setLoading(false);
    };

    loadAll();
    const interval = setInterval(loadAll, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  const todayTasks = tasks.filter((t) => isToday(t.due_date) && t.status !== 'completed');
  const overdueTasks = tasks.filter((t) => isOverdue(t.due_date) && t.status !== 'completed');
  const upcomingEvents = events.filter((e) => isUpcoming(e.event_date, 7));
  const activeGoals = goals.filter((g) => g.status === 'active');
  const monthExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const expiringDocs = documents.filter((d) => {
    const days = daysUntil(d.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h1>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Clock className="h-4 w-4" />
          <span className="text-lg font-medium tabular-nums">
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={CheckSquare}
              label="Today's Tasks"
              value={todayTasks.length}
              sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : 'All on track'}
              color="brand"
              onClick={() => onNavigate('tasks')}
            />
            <StatCard
              icon={CalIcon}
              label="Upcoming Events"
              value={upcomingEvents.length}
              sub="Next 7 days"
              color="emerald"
              onClick={() => onNavigate('calendar')}
            />
            <StatCard
              icon={Target}
              label="Active Goals"
              value={activeGoals.length}
              sub={`${activeGoals.filter((g) => g.progress >= 50).length} halfway+`}
              color="amber"
              onClick={() => onNavigate('goals')}
            />
            <StatCard
              icon={DollarSign}
              label="This Month"
              value={formatCurrency(monthExpenses)}
              sub={`${expenses.length} transactions`}
              color="rose"
              onClick={() => onNavigate('expenses')}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Today's tasks */}
            <Panel
              icon={CheckSquare}
              title="Today's Tasks"
              onMore={() => onNavigate('tasks')}
              className="lg:col-span-2"
            >
              {todayTasks.length === 0 && overdueTasks.length === 0 ? (
                <EmptyRow icon={CheckCircle2} text="No tasks due today. Great job!" />
              ) : (
                <div className="space-y-2">
                  {overdueTasks.map((t) => (
                    <TaskRow key={t.id} task={t} overdue />
                  ))}
                  {todayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              )}
            </Panel>

            {/* Productivity */}
            <Panel icon={TrendingUp} title="Productivity">
              <div className="flex flex-col items-center py-4">
                <div className="relative h-32 w-32">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-gray-200 dark:stroke-gray-700" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                      stroke="currentColor"
                      className="text-brand-500"
                      strokeDasharray={`${(productivity / 100) * 264} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{productivity}%</span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {completedTasks} of {totalTasks} tasks completed
                </p>
              </div>
            </Panel>

            {/* Upcoming events */}
            <Panel icon={CalIcon} title="Upcoming Events" onMore={() => onNavigate('calendar')} className="lg:col-span-2">
              {upcomingEvents.length === 0 ? (
                <EmptyRow icon={CalIcon} text="No upcoming events." />
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 5).map((e) => (
                    <div key={e.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/50">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                        <span className="text-xs font-medium">{new Date(e.event_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-sm font-bold leading-none">{new Date(e.event_date).getDate()}</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{e.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {e.start_time ? `${e.start_time}` : formatDate(e.event_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Active goals */}
            <Panel icon={Target} title="Active Goals" onMore={() => onNavigate('goals')}>
              {activeGoals.length === 0 ? (
                <EmptyRow icon={Target} text="No active goals." />
              ) : (
                <div className="space-y-3">
                  {activeGoals.slice(0, 3).map((g) => (
                    <div key={g.id} className="cursor-pointer" onClick={() => onNavigate('goals')}>
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{g.title}</p>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{g.progress}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${g.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Recent notes */}
            <Panel icon={StickyNote} title="Recent Notes" onMore={() => onNavigate('notes')}>
              {notes.length === 0 ? (
                <EmptyRow icon={StickyNote} text="No notes yet." />
              ) : (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="cursor-pointer rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={() => onNavigate('notes')}>
                      <div className="flex items-center gap-2">
                        {n.pinned && <span className="text-amber-500">★</span>}
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{n.title || 'Untitled'}</p>
                      </div>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{n.content.slice(0, 60)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Reminders */}
            <Panel icon={Bell} title="Reminders" onMore={() => onNavigate('reminders')}>
              {reminders.length === 0 ? (
                <EmptyRow icon={Bell} text="No upcoming reminders." />
              ) : (
                <div className="space-y-2">
                  {reminders.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                      <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.reminder_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Recent documents */}
            <Panel icon={FileText} title="Documents" onMore={() => onNavigate('documents')}>
              {documents.length === 0 ? (
                <EmptyRow icon={FileText} text="No documents." />
              ) : (
                <div className="space-y-2">
                  {documents.slice(0, 3).map((d) => {
                    const days = daysUntil(d.expiry_date);
                    return (
                      <div key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                        <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{d.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {d.category}
                            {days !== null && days <= 30 && days >= 0 && (
                              <span className="ml-1 text-amber-600 dark:text-amber-400">expires in {days}d</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {expiringDocs.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      {expiringDocs.length} document(s) expiring within 30 days
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: typeof CheckSquare;
  label: string;
  value: string | number;
  sub: string;
  color: 'brand' | 'emerald' | 'amber' | 'rose';
  onClick: () => void;
}) {
  const colorClasses = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  };

  return (
    <button
      onClick={onClick}
      className="card flex items-center gap-3 p-4 text-left transition-all hover:shadow-md"
    >
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', colorClasses[color])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="truncate text-xs text-gray-400 dark:text-gray-500">{sub}</p>
      </div>
    </button>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
  onMore,
  className,
}: {
  icon: typeof CheckSquare;
  title: string;
  children: React.ReactNode;
  onMore?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        {onMore && (
          <button onClick={onMore} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            View all
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function TaskRow({ task, overdue }: { task: Task; overdue?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/50">
      <div className={cn('h-2 w-2 shrink-0 rounded-full', overdue ? 'bg-red-500' : 'bg-brand-500')} />
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {task.category} {task.due_time ? `· ${task.due_time}` : ''}
        </p>
      </div>
      <span className={cn('badge', priorityColor(task.priority))}>{task.priority}</span>
      {overdue && <span className={cn('badge', statusColor('overdue'))}>Overdue</span>}
    </div>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: typeof CheckSquare; text: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Icon className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-gray-400 dark:text-gray-500">{text}</p>
    </div>
  );
}
