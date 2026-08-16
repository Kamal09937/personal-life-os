import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, Search, Trash2, Edit3, Archive, ArchiveRestore, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { DocumentItem } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, daysUntil, cn } from '@/lib/utils';

const CATEGORIES = ['General', 'ID', 'License', 'Certificate', 'Insurance', 'Contract', 'Passport', 'Tax', 'Medical', 'Other'];

export function Documents() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { title: '', file_path: '', category: 'General', tags: '', expiry_date: '' };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('documents').select('*').eq('user_id', user.id);
    if (!showArchived) q = q.eq('archived', false);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);
    if (search.trim()) q = q.or(`title.ilike.%${search}%,tags.ilike.%${search}%`);
    const { data } = await q.order('updated_at', { ascending: false });
    setDocs(data ?? []);
    setLoading(false);
  }, [user, showArchived, filterCategory, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (doc: DocumentItem) => {
    setEditing(doc);
    setForm({ title: doc.title, file_path: doc.file_path, category: doc.category, tags: doc.tags, expiry_date: doc.expiry_date ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim()) { notify('Please enter a document title', 'error'); return; }

    const payload = {
      title: form.title.trim(), file_path: form.file_path, category: form.category,
      tags: form.tags, expiry_date: form.expiry_date || null,
    };

    if (editing) {
      const { error } = await supabase.from('documents').update(payload).eq('id', editing.id);
      if (error) { notify('Failed to update document', 'error'); return; }
      notify('Document updated', 'success');
    } else {
      const { error } = await supabase.from('documents').insert({ ...payload, user_id: user.id });
      if (error) { notify('Failed to add document', 'error'); return; }
      notify('Document added', 'success');
    }
    setModalOpen(false);
    load();
  };

  const toggleArchive = async (doc: DocumentItem) => {
    await supabase.from('documents').update({ archived: !doc.archived }).eq('id', doc.id);
    notify(doc.archived ? 'Document restored' : 'Document archived', 'success');
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('documents').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Document deleted', 'success');
    load();
  };

  const openFile = (filePath: string) => {
    if (!filePath) { notify('No file path set for this document', 'info'); return; }
    if (filePath.startsWith('http')) {
      window.open(filePath, '_blank', 'noopener,noreferrer');
    } else {
      notify('File path: ' + filePath, 'info');
    }
  };

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Documents"
        description="Track important documents and their expiry dates"
        action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add Document</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title="No documents found" description="Add your important documents to track expiry dates and details." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add Document</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => {
            const days = daysUntil(doc.expiry_date);
            const expiringSoon = days !== null && days >= 0 && days <= 30;
            const expired = days !== null && days < 0;
            return (
              <div key={doc.id} className="card p-4 transition-all hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 overflow-hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{doc.title}</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{doc.category}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(doc)} className="rounded p-1 text-gray-400 hover:text-brand-500"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => toggleArchive(doc)} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      {doc.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => setDeleteId(doc.id)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                {doc.file_path && (
                  <button onClick={() => openFile(doc.file_path)} className="mb-2 flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400">
                    <ExternalLink className="h-3 w-3" /> Open document
                  </button>
                )}

                {doc.tags && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {doc.tags.split(',').map((tag, i) => tag.trim() && <span key={i} className="text-xs text-gray-400 dark:text-gray-500">#{tag.trim()}</span>)}
                  </div>
                )}

                {doc.expiry_date && (
                  <div className={cn('mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                    expired ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                    expiringSoon ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                    'bg-gray-50 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400')}>
                    <AlertCircle className="h-3.5 w-3.5" />
                    {expired ? `Expired ${Math.abs(days!)}d ago` : `Expires in ${days}d (${formatDate(doc.expiry_date)})`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Document' : 'Add Document'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Add'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Document title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">File Path / URL</label>
            <input className="input" placeholder="https://... or /path/to/file" value={form.file_path} onChange={(e) => setForm({ ...form, file_path: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Expiry Date</label>
              <input type="date" className="input" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input className="input" placeholder="tag1, tag2" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Document"
        message="Are you sure you want to delete this document record?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
