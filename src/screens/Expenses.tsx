import { useEffect, useState, useCallback, useMemo } from 'react';
import { DollarSign, Plus, Search, Trash2, Edit3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import type { Expense } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, formatCurrency, todayISO, monthName, cn } from '@/lib/utils';

const CATEGORIES = ['General', 'Food', 'Transport', 'Housing', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Travel', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Mobile Payment', 'Check', 'Other'];

export function Expenses() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState(todayISO().slice(0, 7));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { amount: '', category: 'General', description: '', payment_method: 'Cash', expense_date: todayISO() };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('expenses').select('*').eq('user_id', user.id);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);
    if (filterMonth) {
      const [y, m] = filterMonth.split('-');
      const start = `${y}-${m}-01`;
      const end = `${y}-${m}-31`;
      q = q.gte('expense_date', start).lte('expense_date', end);
    }
    if (search.trim()) q = q.or(`description.ilike.%${search}%,category.ilike.%${search}%`);
    const { data } = await q.order('expense_date', { ascending: false });
    setExpenses(data ?? []);
    setLoading(false);
  }, [user, filterCategory, filterMonth, search]);

  useEffect(() => { load(); }, [load]);

  const totalAmount = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount), 0), [expenses]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + Number(e.amount);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setForm({ amount: String(exp.amount), category: exp.category, description: exp.description, payment_method: exp.payment_method, expense_date: exp.expense_date });
    setModalOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { notify('Please enter a valid amount', 'error'); return; }

    const payload = {
      amount, category: form.category, description: form.description,
      payment_method: form.payment_method, expense_date: form.expense_date,
    };

    if (editing) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id);
      if (error) { notify('Failed to update expense', 'error'); return; }
      notify('Expense updated', 'success');
    } else {
      const { error } = await supabase.from('expenses').insert({ ...payload, user_id: user.id });
      if (error) { notify('Failed to add expense', 'error'); return; }
      notify('Expense added', 'success');
    }
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('expenses').delete().eq('id', deleteId);
    setDeleteId(null);
    notify('Expense deleted', 'success');
    load();
  };

  return (
    <div>
      <PageHeader
        icon={DollarSign}
        title="Expenses"
        description="Track your spending and view category breakdowns"
        action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add Expense</button>}
      />

      {/* Summary cards */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total ({monthName(new Date(filterMonth + '-01'))})</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{expenses.length} transactions</p>
        </div>
        {categorySummary.slice(0, 2).map(([cat, amt]) => (
          <div key={cat} className="card p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{cat}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(amt)}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(amt / totalAmount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="month" className="input w-auto" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
      ) : expenses.length === 0 ? (
        <EmptyState icon={DollarSign} title="No expenses found" description="Track your spending by adding your first expense." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add Expense</button>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Description</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Category</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Payment</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{exp.description || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-950/40 dark:text-brand-400 dark:border-brand-900">{exp.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{exp.payment_method}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(Number(exp.amount))}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(exp)} className="rounded p-1 text-gray-400 hover:text-brand-500"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(exp.id)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Total:</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Expense' : 'Add Expense'}
        footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>{editing ? 'Save' : 'Add'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="number" step="0.01" min="0" className="input pl-10" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="What was this for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
