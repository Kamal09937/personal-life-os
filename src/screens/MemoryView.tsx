import { useEffect, useState, useCallback } from 'react';
import { Brain, Plus, Search, Pin, Archive, Trash2, Edit3, ArchiveRestore } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { Memory } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { relativeTime, cn } from '@/lib/utils';

const CATEGORIES = ['General', 'Facts', 'Preferences', 'Ideas', 'Plans', 'Projects', 'Important Dates', 'Knowledge', 'Contacts'];

export function MemoryView() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { title: '', content: '', category: 'General' };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('memories').select('*').eq('user_id', user.id);
    if (!showArchived) q = q.eq('archived', false);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);
    if (search.trim()) q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    const { data } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false });
    setMemories(data ?? []);
    setLoading(false);
  }, [user, showArchived, filterCategory, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (mem: Memory) => {
    setEditing(mem);
    setForm({ title: mem.title, content: mem.content, category: mem.category });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim()) { notify('Please enter a title', 'error'); return; }

    const payload = { title: form.title.trim(), content: form.content, category: form.category };

    if (editing) {
      const { error } = await supabase.from('memories').update(payload).eq('id', editing.id);
      if (error) { notify('Failed to update memory', 'error'); return; }
      notify('Memory updated', 'success');
    } else {
      const { error } = await supabase.from('memories').insert({ ...payload, user_id: user.id });
      if (error) { notify('Failed to create memory', 'error'); return; }
      notify('Memory saved', 'success');
    }
    setModalOpen(false);
    load();
  };

  const togglePin = async (mem: Memory) => {
    await supabase.from('memories').update({ pinned: !mem.pinned }).eq('id', mem.id);
    load();
  };

  const toggleArchive = async (mem: Memory) => {
    await supabase.from('memories').update({ archived: !mem.archived }).eq('id', mem.id);
    notify(mem.archived ? 'Memory restored' : 'Memory archived', 'success');
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('memories').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Memory deleted', 'success');
    load();
  };

  return (
    <div>
      <PageHeader
        icon={Brain}
        title="Personal Memory"
        description="Store facts, preferences, ideas, and knowledge for quick recall"
        action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Memory</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search memories..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className={cn('btn-secondary', showArchived && 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400')} onClick={() => setShowArchived(!showArchived)}>
          <Archive className="h-4 w-4" /> {showArchived ? 'Archived' : 'Active'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
      ) : memories.length === 0 ? (
        <EmptyState icon={Brain} title="No memories stored" description="Save important information, facts, and ideas for quick recall." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Memory</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memories.map((mem) => (
            <div key={mem.id} className={cn('card p-4 transition-all hover:shadow-md', mem.pinned && 'ring-2 ring-amber-300 dark:ring-amber-700')}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                  {mem.pinned && <span className="text-amber-500 mr-1">★</span>}
                  {mem.title}
                </h3>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => togglePin(mem)} className="rounded p-1 text-gray-400 hover:text-amber-500">
                    <Pin className={cn('h-3.5 w-3.5', mem.pinned && 'fill-amber-400 text-amber-500')} />
                  </button>
                  <button onClick={() => openEdit(mem)} className="rounded p-1 text-gray-400 hover:text-brand-500"><Edit3 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleArchive(mem)} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {mem.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setDeleteId(mem.id)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 whitespace-pre-wrap">{mem.content}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="badge bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900">{mem.category}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(mem.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Memory' : 'New Memory'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Memory title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea className="input min-h-[120px] resize-y" placeholder="Store your information here..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Memory"
        message="Are you sure you want to delete this memory?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
