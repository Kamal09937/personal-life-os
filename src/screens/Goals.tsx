import { useEffect, useState, useCallback } from 'react';
import { Target, Plus, Trash2, Edit3, Milestone, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { Goal, Milestone as MilestoneType, Priority, GoalStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, priorityColor, statusColor, formatStatus, cn } from '@/lib/utils';

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const STATUSES: GoalStatus[] = ['active', 'completed', 'paused'];

export function Goals() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');

  const emptyForm = { title: '', description: '', start_date: '', target_date: '', progress: 0, priority: 'medium' as Priority, status: 'active' as GoalStatus };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) {
      const goalsWithMilestones = await Promise.all(
        data.map(async (g) => {
          const { data: ms } = await supabase.from('milestones').select('*').eq('goal_id', g.id).order('created_at', { ascending: true });
          return { ...g, milestones: ms ?? [] };
        })
      );
      setGoals(goalsWithMilestones);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setForm({
      title: goal.title, description: goal.description,
      start_date: goal.start_date ?? '', target_date: goal.target_date ?? '',
      progress: goal.progress, priority: goal.priority, status: goal.status,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim()) { notify('Please enter a goal title', 'error'); return; }

    const payload = {
      title: form.title.trim(), description: form.description,
      start_date: form.start_date || null, target_date: form.target_date || null,
      progress: form.progress, priority: form.priority, status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from('goals').update(payload).eq('id', editing.id);
      if (error) { notify('Failed to update goal', 'error'); return; }
      notify('Goal updated', 'success');
    } else {
      const { error } = await supabase.from('goals').insert({ ...payload, user_id: user.id });
      if (error) { notify('Failed to create goal', 'error'); return; }
      notify('Goal created', 'success');
    }
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('milestones').delete().eq('goal_id', deleteId);
    await supabase.from('goals').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Goal deleted', 'success');
    load();
  };

  const addMilestone = async (goalId: string) => {
    if (!user || !milestoneTitle.trim()) return;
    const { error } = await supabase.from('milestones').insert({
      goal_id: goalId, user_id: user.id, title: milestoneTitle.trim(),
    });
    if (error) { notify('Failed to add milestone', 'error'); return; }
    setMilestoneTitle('');
    load();
  };

  const toggleMilestone = async (m: MilestoneType) => {
    await supabase.from('milestones').update({ completed: !m.completed }).eq('id', m.id);
    load();
  };

  const deleteMilestone = async (id: string) => {
    await supabase.from('milestones').delete().eq('id', id);
    load();
  };

  const updateProgress = async (goal: Goal, progress: number) => {
    const newProgress = Math.max(0, Math.min(100, progress));
    const newStatus = newProgress === 100 ? 'completed' : goal.status === 'completed' ? 'active' : goal.status;
    await supabase.from('goals').update({ progress: newProgress, status: newStatus }).eq('id', goal.id);
    load();
  };

  return (
    <div>
      <PageHeader
        icon={Target}
        title="Goals"
        description="Set, track, and achieve your long-term objectives"
        action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Goal</button>}
      />

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
      ) : goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set your first goal and start tracking your progress." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Goal</button>} />
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <div key={goal.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{goal.title}</h3>
                    <span className={cn('badge', statusColor(goal.status))}>{formatStatus(goal.status)}</span>
                    <span className={cn('badge', priorityColor(goal.priority))}>{goal.priority}</span>
                  </div>
                  {goal.description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{goal.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    {goal.start_date && <span>Start: {formatDate(goal.start_date)}</span>}
                    {goal.target_date && <span>Target: {formatDate(goal.target_date)}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(goal)} className="rounded p-1 text-gray-400 hover:text-brand-500"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(goal.id)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Progress</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{goal.progress}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={0} max={100} value={goal.progress}
                    onChange={(e) => updateProgress(goal, parseInt(e.target.value))}
                    className="flex-1 accent-brand-600"
                  />
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${goal.progress}%` }} />
                  </div>
                </div>
              </div>

              {/* Milestones */}
              <div className="mt-4">
                <button
                  onClick={() => setExpandedId(expandedId === goal.id ? null : goal.id)}
                  className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <Milestone className="h-3.5 w-3.5" />
                  {goal.milestones?.length ?? 0} milestone(s)
                </button>

                {expandedId === goal.id && (
                  <div className="mt-3 animate-fade-in">
                    <div className="space-y-1">
                      {goal.milestones?.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <button onClick={() => toggleMilestone(m)}>
                            {m.completed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600" />}
                          </button>
                          <span className={cn('flex-1 text-sm', m.completed && 'line-through text-gray-400 dark:text-gray-500')}>{m.title}</span>
                          <button onClick={() => deleteMilestone(m.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="input text-sm"
                        placeholder="Add milestone..."
                        value={milestoneTitle}
                        onChange={(e) => setMilestoneTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { addMilestone(goal.id); } }}
                      />
                      <button className="btn-secondary text-sm" onClick={() => addMilestone(goal.id)}>Add</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Goal' : 'New Goal'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Goal title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[60px] resize-y" placeholder="Goal description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Target Date</label>
              <input type="date" className="input" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as GoalStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Progress: {form.progress}%</label>
            <input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) })} className="w-full accent-brand-600" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Goal"
        message="Are you sure you want to delete this goal and all its milestones?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
