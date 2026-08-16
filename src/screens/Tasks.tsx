import { useEffect, useState, useCallback } from 'react';
import { CheckSquare, Plus, Search, Trash2, Edit3, Calendar as CalIcon, Clock, Repeat } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { Task, Priority, TaskStatus, Recurring } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, todayISO, isOverdue, priorityColor, statusColor, formatStatus, cn } from '@/lib/utils';

const CATEGORIES = ['General', 'Work', 'Personal', 'Health', 'Finance', 'Home', 'Learning'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'overdue'];
const RECURRING: Recurring[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

export function Tasks() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created_at'>('due_date');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = {
    title: '', description: '', priority: 'medium' as Priority, status: 'pending' as TaskStatus,
    due_date: '', due_time: '', recurring: 'none' as Recurring, category: 'General',
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('tasks').select('*').eq('user_id', user.id);
    if (filterStatus !== 'all') q = q.eq('status', filterStatus);
    if (filterPriority !== 'all') q = q.eq('priority', filterPriority);
    if (search.trim()) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    q = q.order(sortBy, { ascending: sortBy === 'due_date' });
    const { data } = await q;
    setTasks(data ?? []);
    setLoading(false);
  }, [user, filterStatus, filterPriority, search, sortBy]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date ?? '',
      due_time: task.due_time ?? '',
      recurring: task.recurring,
      category: task.category,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim()) { notify('Please enter a task title', 'error'); return; }

    const payload = {
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      recurring: form.recurring,
      category: form.category,
    };

    if (editing) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editing.id);
      if (error) { notify('Failed to update task', 'error'); return; }
      notify('Task updated', 'success');
    } else {
      const { error } = await supabase.from('tasks').insert({ ...payload, user_id: user.id });
      if (error) { notify('Failed to create task', 'error'); return; }
      notify('Task created', 'success');
    }
    setModalOpen(false);
    load();
  };

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    load();
  };

  const cycleStatus = async (task: Task) => {
    const order: TaskStatus[] = ['pending', 'in_progress', 'completed'];
    const currentIdx = order.indexOf(task.status === 'overdue' ? 'pending' : task.status);
    const next = order[(currentIdx + 1) % order.length];
    await supabase.from('tasks').update({ status: next }).eq('id', task.id);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('tasks').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Task deleted', 'success');
    load();
  };

  return (
    <div>
      <PageHeader
        icon={CheckSquare}
        title="Tasks"
        description="Manage your to-dos with priorities, due dates, and recurring schedules"
        action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Task</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
        <select className="input w-auto" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="all">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="due_date">Sort: Due Date</option>
          <option value="priority">Sort: Priority</option>
          <option value="created_at">Sort: Created</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks found" description="Create a task to start managing your to-dos." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Task</button>} />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const overdue = isOverdue(task.due_date) && task.status !== 'completed';
            return (
              <div key={task.id} className={cn('card flex items-center gap-3 p-3', task.status === 'completed' && 'opacity-60', overdue && 'border-red-200 dark:border-red-900')}>
                <button
                  onClick={() => toggleStatus(task)}
                  className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all',
                    task.status === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 hover:border-brand-500 dark:border-gray-600')}
                >
                  {task.status === 'completed' && <CheckSquare className="h-3 w-3" />}
                </button>
                <div className="flex-1 overflow-hidden">
                  <p className={cn('text-sm font-medium text-gray-900 dark:text-gray-100', task.status === 'completed' && 'line-through')}>
                    {task.title}
                  </p>
                  {task.description && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{task.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span className="badge bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600">{task.category}</span>
                    {task.due_date && (
                      <span className={cn('flex items-center gap-1', overdue && 'text-red-500 font-medium')}>
                        <CalIcon className="h-3 w-3" /> {formatDate(task.due_date)}
                      </span>
                    )}
                    {task.due_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {task.due_time}</span>}
                    {task.recurring !== 'none' && <span className="flex items-center gap-1"><Repeat className="h-3 w-3" /> {task.recurring}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => cycleStatus(task)} className={cn('badge cursor-pointer', statusColor(task.status))} title="Click to change status">
                    {formatStatus(task.status)}
                  </button>
                  <span className={cn('badge', priorityColor(task.priority))}>{task.priority}</span>
                  <button onClick={() => openEdit(task)} className="rounded p-1 text-gray-400 hover:text-brand-500"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(task.id)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Task' : 'New Task'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-y" placeholder="Task description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Due Time</label>
              <input type="time" className="input" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Recurring</label>
              <select className="input" value={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.value as Recurring })}>
                {RECURRING.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
