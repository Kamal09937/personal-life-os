import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Loader2, User2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { PageHeader } from '@/components/PageHeader';
import { formatDate, formatCurrency, todayISO, isToday, isUpcoming, isOverdue, daysUntil } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AIAssistant() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI assistant. I can help you with your tasks, events, goals, expenses, notes, and more. Try asking:\n\n• What tasks are due today?\n• Show my active goals\n• What expenses did I make this month?\n• Create a task to renew my license\n• Summarize my productivity this week",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || loading) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const response = await processQuery(userMsg, user.id);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error processing your request. Please try again.' }]);
    }
    setLoading(false);
  };

  async function processQuery(query: string, userId: string): Promise<string> {
    const lower = query.toLowerCase();
    const today = todayISO();

    // Create a task
    if (lower.includes('create a task') || lower.includes('add a task') || lower.includes('remind me to')) {
      const titleMatch = query.match(/(?:task (?:to|for)|remind me (?:to|about))\s+(.+)/i);
      if (titleMatch) {
        const title = titleMatch[1].trim();
        let dueDate = today;
        if (lower.includes('next month')) {
          const d = new Date();
          d.setMonth(d.getMonth() + 1);
          dueDate = d.toISOString().slice(0, 10);
        } else if (lower.includes('tomorrow')) {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          dueDate = d.toISOString().slice(0, 10);
        } else if (lower.includes('next week')) {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          dueDate = d.toISOString().slice(0, 10);
        }
        const { error } = await supabase.from('tasks').insert({
          user_id: userId, title, status: 'pending', due_date: dueDate, category: 'General', priority: 'medium', recurring: 'none',
        });
        if (error) return 'I could not create that task. Please try again.';
        return `Done! I created a task "${title}" due on ${formatDate(dueDate)}.`;
      }
    }

    // Tasks due today
    if (lower.includes('task') && (lower.includes('due today') || lower.includes('today'))) {
      const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'completed');
      const dueToday = (data ?? []).filter((t) => isToday(t.due_date));
      const overdue = (data ?? []).filter((t) => isOverdue(t.due_date));
      if (dueToday.length === 0 && overdue.length === 0) return 'You have no tasks due today. Great job!';
      let response = '';
      if (dueToday.length > 0) {
        response += `You have ${dueToday.length} task(s) due today:\n`;
        dueToday.forEach((t) => { response += `• ${t.title} (${t.priority} priority)\n`; });
      }
      if (overdue.length > 0) {
        response += `\nYou also have ${overdue.length} overdue task(s):\n`;
        overdue.forEach((t) => { response += `• ${t.title} - was due ${formatDate(t.due_date)}\n`; });
      }
      return response.trim();
    }

    // Upcoming events
    if (lower.includes('event') && (lower.includes('upcoming') || lower.includes('next'))) {
      const { data } = await supabase.from('events').select('*').eq('user_id', userId).gte('event_date', today).order('event_date', { ascending: true }).limit(10);
      const upcoming = (data ?? []).filter((e) => isUpcoming(e.event_date, 14));
      if (upcoming.length === 0) return 'You have no upcoming events in the next 2 weeks.';
      let response = `You have ${upcoming.length} upcoming event(s):\n`;
      upcoming.forEach((e) => { response += `• ${e.title} - ${formatDate(e.event_date)}${e.start_time ? ` at ${e.start_time}` : ''}\n`; });
      return response.trim();
    }

    // Active goals
    if (lower.includes('goal') && (lower.includes('active') || lower.includes('show') || lower.includes('my'))) {
      const { data } = await supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').order('target_date', { ascending: true });
      if (!data || data.length === 0) return 'You have no active goals. Consider setting one!';
      let response = `You have ${data.length} active goal(s):\n`;
      data.forEach((g) => {
        response += `• ${g.title} - ${g.progress}% complete`;
        if (g.target_date) response += ` (target: ${formatDate(g.target_date)})`;
        response += '\n';
      });
      return response.trim();
    }

    // Find documents
    if (lower.includes('document') || lower.includes('insurance') || lower.includes('license') || lower.includes('passport') || lower.includes('certificate')) {
      const { data } = await supabase.from('documents').select('*').eq('user_id', userId).eq('archived', false);
      const filtered = (data ?? []).filter((d) =>
        lower.includes(d.category.toLowerCase()) ||
        lower.includes('document') ||
        d.title.toLowerCase().includes(lower.match(/insurance|license|passport|certificate|contract/i)?.[0] ?? '')
      );
      if (filtered.length === 0) return 'I could not find any matching documents.';
      let response = `I found ${filtered.length} document(s):\n`;
      filtered.forEach((d) => {
        response += `• ${d.title} (${d.category})`;
        const days = daysUntil(d.expiry_date);
        if (days !== null && days >= 0 && days <= 30) response += ` - expires in ${days} days!`;
        else if (days !== null && days < 0) response += ` - EXPIRED`;
        response += '\n';
      });
      return response.trim();
    }

    // Expenses this month
    if (lower.includes('expense') && (lower.includes('month') || lower.includes('spend'))) {
      const monthStart = new Date();
      monthStart.setDate(1);
      const { data } = await supabase.from('expenses').select('*').eq('user_id', userId).gte('expense_date', monthStart.toISOString().slice(0, 10));
      const total = (data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
      if (!data || data.length === 0) return 'You have no expenses recorded this month.';
      const byCategory: Record<string, number> = {};
      data.forEach((e) => { byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount); });
      let response = `This month you've spent ${formatCurrency(total)} across ${data.length} transactions:\n`;
      Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
        response += `• ${cat}: ${formatCurrency(amt)}\n`;
      });
      return response.trim();
    }

    // Summarize notes
    if (lower.includes('note') && (lower.includes('summar') || lower.includes('about'))) {
      const keyword = lower.match(/about\s+(.+)/)?.[1] ?? '';
      let q = supabase.from('notes').select('*').eq('user_id', userId).eq('archived', false);
      if (keyword) q = q.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,category.ilike.%${keyword}%`);
      const { data } = await q.order('updated_at', { ascending: false }).limit(10);
      if (!data || data.length === 0) return 'I could not find any matching notes.';
      let response = `Here's a summary of your ${data.length} most recent note(s)${keyword ? ` about "${keyword}"` : ''}:\n`;
      data.forEach((n) => {
        response += `• ${n.title || 'Untitled'} (${n.category}): ${n.content.slice(0, 100)}${n.content.length > 100 ? '...' : ''}\n`;
      });
      return response.trim();
    }

    // Deadlines coming up
    if (lower.includes('deadline') || lower.includes('coming up')) {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId).in('status', ['pending', 'in_progress']).order('due_date', { ascending: true });
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').order('target_date', { ascending: true });
      let response = '';
      const upcomingTasks = (tasks ?? []).filter((t) => t.due_date && daysUntil(t.due_date) !== null && daysUntil(t.due_date)! >= 0 && daysUntil(t.due_date)! <= 14);
      if (upcomingTasks.length > 0) {
        response += `Upcoming task deadlines:\n`;
        upcomingTasks.slice(0, 5).forEach((t) => {
          const days = daysUntil(t.due_date)!;
          response += `• ${t.title} - ${days === 0 ? 'today' : `in ${days} day(s)`}\n`;
        });
      }
      const upcomingGoals = (goals ?? []).filter((g) => g.target_date && daysUntil(g.target_date) !== null && daysUntil(g.target_date)! >= 0 && daysUntil(g.target_date)! <= 30);
      if (upcomingGoals.length > 0) {
        response += `\nGoal deadlines approaching:\n`;
        upcomingGoals.slice(0, 3).forEach((g) => {
          const days = daysUntil(g.target_date)!;
          response += `• ${g.title} - in ${days} day(s) (${g.progress}% done)\n`;
        });
      }
      return response.trim() || 'No upcoming deadlines in the next 2 weeks. You are on track!';
    }

    // Productivity summary
    if (lower.includes('productiv') || lower.includes('summar') && lower.includes('week')) {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId);
      const completed = (tasks ?? []).filter((t) => t.status === 'completed').length;
      const total = tasks?.length ?? 0;
      const pending = (tasks ?? []).filter((t) => t.status === 'pending').length;
      const inProgress = (tasks ?? []).filter((t) => t.status === 'in_progress').length;
      const overdue = (tasks ?? []).filter((t) => t.status === 'overdue').length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active');
      let response = `Here's your productivity overview:\n\n`;
      response += `Tasks: ${total} total\n• Completed: ${completed} (${rate}%)\n• In Progress: ${inProgress}\n• Pending: ${pending}\n• Overdue: ${overdue}\n\n`;
      response += `Active Goals: ${goals?.length ?? 0}\n`;
      if (goals && goals.length > 0) {
        const avgProgress = Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
        response += `Average Goal Progress: ${avgProgress}%\n`;
      }
      return response.trim();
    }

    // Show reminders
    if (lower.includes('reminder')) {
      const { data } = await supabase.from('reminders').select('*').eq('user_id', userId).eq('completed', false).gte('reminder_date', today).order('reminder_date', { ascending: true }).limit(10);
      if (!data || data.length === 0) return 'You have no upcoming reminders.';
      let response = `You have ${data.length} upcoming reminder(s):\n`;
      data.forEach((r) => { response += `• ${r.title} - ${formatDate(r.reminder_date)}${r.reminder_time ? ` at ${r.reminder_time}` : ''}\n`; });
      return response.trim();
    }

    // Memory search
    if (lower.includes('memory') || lower.includes('remember')) {
      const keyword = lower.match(/(?:memory|remember)\s+(?:about\s+)?(.+)/)?.[1] ?? '';
      let q = supabase.from('memories').select('*').eq('user_id', userId).eq('archived', false);
      if (keyword) q = q.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`);
      const { data } = await q.limit(5);
      if (!data || data.length === 0) return 'I could not find any relevant memories.';
      let response = `Here are your relevant memories:\n`;
      data.forEach((m) => { response += `• ${m.title} (${m.category}): ${m.content.slice(0, 100)}\n`; });
      return response.trim();
    }

    return "I can help you with:\n• Tasks due today\n• Upcoming events\n• Active goals\n• Finding documents\n• Monthly expenses\n• Note summaries\n• Upcoming deadlines\n• Productivity summary\n• Reminders\n• Personal memories\n\nTry rephrasing your question using one of these topics!";
  }

  return (
    <div>
      <PageHeader icon={Bot} title="AI Assistant" description="Ask questions about your data and get instant answers" />

      <div className="card flex h-[calc(100vh-220px)] min-h-[400px] flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                  <User2 className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-700">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ask me anything about your data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
            />
            <button className="btn-primary" onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
