import { useEffect, useState, useCallback, useMemo } from 'react';
import { Calendar as CalIcon, Plus, Trash2, Edit3, ChevronLeft, ChevronRight, Clock, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { EventItem, Recurring } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { cn, formatDate, todayISO } from '@/lib/utils';

const RECURRING: Recurring[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { title: '', description: '', event_date: selectedDate, start_time: '', end_time: '', reminder_time: '', recurring: 'none' as Recurring };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .gte('event_date', monthStart.toISOString().slice(0, 10))
      .lte('event_date', monthEnd.toISOString().slice(0, 10))
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });
    setEvents(data ?? []);
    setLoading(false);
  }, [user, currentMonth]);

  useEffect(() => { load(); }, [load]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    for (const e of events) {
      const key = e.event_date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const selectedDateEvents = eventsByDate[selectedDate] ?? [];

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(dateStr);
    }
    return days;
  }, [currentMonth]);

  const openCreate = (date?: string) => {
    setEditing(null);
    setForm({ ...emptyForm, event_date: date ?? selectedDate });
    setModalOpen(true);
  };

  const openEdit = (event: EventItem) => {
    setEditing(event);
    setForm({
      title: event.title, description: event.description, event_date: event.event_date,
      start_time: event.start_time ?? '', end_time: event.end_time ?? '', reminder_time: event.reminder_time ?? '', recurring: event.recurring,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim()) { notify('Please enter an event title', 'error'); return; }
    if (!form.event_date) { notify('Please select a date', 'error'); return; }

    const payload = {
      title: form.title.trim(), description: form.description, event_date: form.event_date,
      start_time: form.start_time || null, end_time: form.end_time || null,
      reminder_time: form.reminder_time || null, recurring: form.recurring,
    };

    if (editing) {
      const { error } = await supabase.from('events').update(payload).eq('id', editing.id);
      if (error) { notify('Failed to update event', 'error'); return; }
      notify('Event updated', 'success');
    } else {
      const { error } = await supabase.from('events').insert({ ...payload, user_id: user.id });
      if (error) { notify('Failed to create event', 'error'); return; }
      notify('Event created', 'success');
    }
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('events').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Event deleted', 'success');
    load();
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  return (
    <div>
      <PageHeader
        icon={CalIcon}
        title="Calendar"
        description="Schedule and track your events"
        action={<button className="btn-primary" onClick={() => openCreate()}><Plus className="h-4 w-4" /> New Event</button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar grid */}
        <div className="card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="btn-ghost p-2"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(todayISO()); }} className="btn-secondary text-xs">Today</button>
              <button onClick={nextMonth} className="btn-ghost p-2"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 dark:text-gray-500">{d}</div>
            ))}
            {calendarDays.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const dayEvents = eventsByDate[dateStr] ?? [];
              const isToday = dateStr === todayISO();
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'flex min-h-[64px] flex-col items-start rounded-lg border p-1.5 text-left transition-all',
                    isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 dark:border-brand-700' : 'border-gray-100 hover:border-gray-200 dark:border-gray-700/50 dark:hover:border-gray-600',
                    isToday && !isSelected && 'bg-amber-50 dark:bg-amber-950/20'
                  )}
                >
                  <span className={cn('text-xs font-medium', isToday ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400')}>
                    {parseInt(dateStr.slice(-2))}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-1 w-full space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div key={e.id} className="truncate rounded bg-brand-100 px-1 py-0.5 text-[10px] text-brand-700 dark:bg-brand-950/60 dark:text-brand-400">
                          {e.start_time && <span className="font-medium">{e.start_time} </span>}
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && <span className="text-[10px] text-gray-400">+{dayEvents.length - 2} more</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected date events */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(selectedDate)}
            </h3>
            <button className="btn-ghost p-1.5 text-xs" onClick={() => openCreate(selectedDate)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
          ) : selectedDateEvents.length === 0 ? (
            <div className="py-8 text-center">
              <CalIcon className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No events on this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDateEvents.map((e) => (
                <div key={e.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {e.start_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {e.start_time}{e.end_time ? ` - ${e.end_time}` : ''}</span>}
                        {e.reminder_time && <span className="flex items-center gap-1"><Bell className="h-3 w-3" /> {e.reminder_time}</span>}
                      </div>
                      {e.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{e.description}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(e)} className="rounded p-1 text-gray-400 hover:text-brand-500"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleteId(e.id)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Event' : 'New Event'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[60px] resize-y" placeholder="Event description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Recurring</label>
              <select className="input" value={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.value as Recurring })}>
                {RECURRING.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Reminder Time</label>
              <input type="time" className="input" value={form.reminder_time} onChange={(e) => setForm({ ...form, reminder_time: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Event"
        message="Are you sure you want to delete this event?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
