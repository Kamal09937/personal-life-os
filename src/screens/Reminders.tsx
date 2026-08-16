import { useEffect, useState, useCallback } from 'react';
import { Bell, Plus, Trash2, Edit3, CheckCircle2, Circle, Repeat } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { Reminder as ReminderType, Recurring } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, todayISO, cn } from '@/lib/utils';

const RECURRING: Recurring[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

export function Reminders() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [reminders, setReminders] = useState<ReminderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderType | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { title: '', description: '', reminder_date: todayISO(), reminder_time: '', recurring: 'none' as Recurring };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('reminders').select('*').eq('user_id', user.id);
    if (!showCompleted) q = q.eq('completed', false);
    const { data } = await q.order('reminder_date', { ascending: true });
    setReminders(data ?? []);
    setLoading(false);
  }, [user, showCompleted]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (rem: ReminderType) => {
    setEditing(rem);
    setForm({ title: rem.title, description: rem.description, reminder_date: rem.reminder_date, reminder_time: rem.reminder_time ?? '', recurring: rem.recurring });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim()) { notify('Please enter a reminder title', 'error'); return; }
    if (!form.reminder_date) { notify('Please select a date', 'error'); return; }

    const payload = {
      title: form.title.trim(), description: form.description,
      reminder_date: form.reminder_date, reminder_time: form.reminder_time || null, recurring: form.recurring,
    };

    if (editing) {
      const { error } = await supabase.from('reminders').update(payload).eq('id', editing.id);
      if (error) { notify('Failed to update reminder', 'error'); return; }
      notify('Reminder updated', 'success');
    } else {
      const { error } = await supabase.from('reminders').insert({ ...payload, user_id: user.id });
      if (error) { notify('Failed to create reminder', 'error'); return; }
      notify('Reminder created', 'success');
    }
    setModalOpen(false);
    load();
  };

  const toggleComplete = async (rem: ReminderType) => {
    await supabase.from('reminders').update({ completed: !rem.completed }).eq('id', rem.id);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('reminders').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Reminder deleted', 'success');
    load();
  };

  return (
    <div>
      <PageHeader
        icon={Bell}
        title="Reminders"
        description="Never miss an important date or task"
        action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Reminder</button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <button className={cn('btn-secondary', showCompleted && 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400')} onClick={() => setShowCompleted(!showCompleted)}>
          {showCompleted ? 'Showing Completed' : 'Showing Active'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
      ) : reminders.length === 0 ? (
        <EmptyState icon={Bell} title="No reminders found" description="Create a reminder to get notified about important dates." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Reminder</button>} />
      ) : (
        <div className="space-y-2">
          {reminders.map((rem) => {
            const isPast = rem.reminder_date < todayISO() && !rem.completed;
            return (
              <div key={rem.id} className={cn('card flex items-center gap-3 p-3', rem.completed && 'opacity-60', isPast && 'border-amber-200 dark:border-amber-900')}>
                <button onClick={() => toggleComplete(rem)} className="shrink-0">
                  {rem.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" />}
                </button>
                <div className="flex-1 overflow-hidden">
                  <p className={cn('text-sm font-medium text-gray-900 dark:text-gray-100', rem.completed && 'line-through')}>{rem.title}</p>
                  {rem.description && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{rem.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span className={cn(isPast && 'text-amber-600 dark:text-amber-400 font-medium')}>{formatDate(rem.reminder_date)}</span>
                    {rem.reminder_time && <span>{rem.reminder_time}</span>}
                    {rem.recurring !== 'none' && <span className="flex items-center gap-1"><Repeat className="h-3 w-3" /> {rem.recurring}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(rem)} className="rounded p-1 text-gray-400 hover:text-brand-500"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(rem.id)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Reminder' : 'New Reminder'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Reminder title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[60px] resize-y" placeholder="Reminder details..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.reminder_date} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Time</label>
              <input type="time" className="input" value={form.reminder_time} onChange={(e) => setForm({ ...form, reminder_time: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Recurring</label>
            <select className="input" value={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.value as Recurring })}>
              {RECURRING.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Reminder"
        message="Are you sure you want to delete this reminder?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
