import { useEffect, useState, useCallback } from 'react';
import { StickyNote, Plus, Search, Pin, Archive, Trash2, Edit3, ArchiveRestore } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { Note } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, relativeTime, cn } from '@/lib/utils';

const CATEGORIES = ['General', 'Personal', 'Work', 'Ideas', 'Project', 'Research', 'Journal'];

export function Notes() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({ title: '', content: '', category: 'General', tags: '' });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('notes').select('*').eq('user_id', user.id);
    if (!showArchived) q = q.eq('archived', false);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);
    if (search.trim()) q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%,tags.ilike.%${search}%`);
    const { data } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false });
    setNotes(data ?? []);
    setLoading(false);
  }, [user, showArchived, filterCategory, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', content: '', category: 'General', tags: '' });
    setModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditing(note);
    setForm({ title: note.title, content: note.content, category: note.category, tags: note.tags });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim()) { notify('Please enter a title', 'error'); return; }

    if (editing) {
      const { error } = await supabase.from('notes').update({
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags: form.tags,
      }).eq('id', editing.id);
      if (error) { notify('Failed to update note', 'error'); return; }
      notify('Note updated', 'success');
    } else {
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags: form.tags,
      });
      if (error) { notify('Failed to create note', 'error'); return; }
      notify('Note created', 'success');
    }
    setModalOpen(false);
    load();
  };

  const togglePin = async (note: Note) => {
    await supabase.from('notes').update({ pinned: !note.pinned }).eq('id', note.id);
    load();
  };

  const toggleArchive = async (note: Note) => {
    await supabase.from('notes').update({ archived: !note.archived }).eq('id', note.id);
    notify(note.archived ? 'Note restored' : 'Note archived', 'success');
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('notes').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Note deleted', 'success');
    load();
  };

  return (
    <div>
      <PageHeader
        icon={StickyNote}
        title="Notes"
        description="Capture ideas, thoughts, and information"
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Note
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className={cn('btn-secondary', showArchived && 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400')}
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive className="h-4 w-4" /> {showArchived ? 'Archived' : 'Active'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
      ) : notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes found" description="Create your first note to get started." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New Note</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div key={note.id} className={cn('card p-4 transition-all hover:shadow-md', note.pinned && 'ring-2 ring-amber-300 dark:ring-amber-700')}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                  {note.pinned && <span className="text-amber-500 mr-1">★</span>}
                  {note.title || 'Untitled'}
                </h3>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => togglePin(note)} className="rounded p-1 text-gray-400 hover:text-amber-500" title={note.pinned ? 'Unpin' : 'Pin'}>
                    <Pin className={cn('h-3.5 w-3.5', note.pinned && 'fill-amber-400 text-amber-500')} />
                  </button>
                  <button onClick={() => openEdit(note)} className="rounded p-1 text-gray-400 hover:text-brand-500" title="Edit">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleArchive(note)} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title={note.archived ? 'Restore' : 'Archive'}>
                    {note.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setDeleteId(note.id)} className="rounded p-1 text-gray-400 hover:text-red-500" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">{note.content}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="badge bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-950/40 dark:text-brand-400 dark:border-brand-900">{note.category}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(note.updated_at)}</span>
              </div>
              {note.tags && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.split(',').map((tag, i) => tag.trim() && (
                    <span key={i} className="text-xs text-gray-400 dark:text-gray-500">#{tag.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Note' : 'New Note'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Create'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Note title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea className="input min-h-[120px] resize-y" placeholder="Write your note..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tags (comma-separated)</label>
              <input className="input" placeholder="tag1, tag2" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
