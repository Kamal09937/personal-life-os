import { useState } from 'react';
import { Settings as SettingsIcon, User2, Lock, Palette, Bell, Database, Download, Upload, LogOut, Moon, Sun, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/utils';

export function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { notify } = useNotification();
  const [passwordModal, setPasswordModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importText, setImportText] = useState('');
  const [exportData, setExportData] = useState('');
  const [notifications, setNotifications] = useState(true);

  const changePassword = async () => {
    if (newPassword.length < 6) { notify('Password must be at least 6 characters', 'error'); return; }
    if (newPassword !== confirmPassword) { notify('Passwords do not match', 'error'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { notify(error.message, 'error'); return; }
    notify('Password updated successfully', 'success');
    setPasswordModal(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleExport = async () => {
    if (!user) return;
    const tables = ['notes', 'tasks', 'events', 'goals', 'documents', 'expenses', 'reminders', 'memories'];
    const data: Record<string, unknown> = {};
    for (const table of tables) {
      const { data: rows } = await supabase.from(table).select('*').eq('user_id', user.id);
      data[table] = rows ?? [];
    }
    const text = JSON.stringify(data, null, 2);
    setExportData(text);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Data exported successfully', 'success');
  };

  const handleImport = async () => {
    if (!user) return;
    try {
      const data = JSON.parse(importText);
      const tables = ['notes', 'tasks', 'events', 'goals', 'documents', 'expenses', 'reminders', 'memories'];
      let imported = 0;
      for (const table of tables) {
        if (Array.isArray(data[table])) {
          for (const row of data[table]) {
            const { id, user_id, created_at, updated_at, ...rest } = row;
            await supabase.from(table).insert({ ...rest, user_id: user.id });
            imported++;
          }
        }
      }
      notify(`Imported ${imported} record(s) successfully`, 'success');
      setImportModal(false);
      setImportText('');
    } catch {
      notify('Invalid JSON data', 'error');
    }
  };

  return (
    <div>
      <PageHeader icon={SettingsIcon} title="Settings" description="Manage your account, preferences, and data" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <User2 className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profile</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Email</label>
              <input className="input bg-gray-50 dark:bg-gray-700/50" value={user?.email ?? ''} disabled />
            </div>
            <div>
              <label className="label">User ID</label>
              <input className="input bg-gray-50 dark:bg-gray-700/50 text-xs" value={user?.id ?? ''} disabled />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Appearance</h3>
          </div>
          <div className="space-y-3">
            <label className="label">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTheme('light')}
                className={cn('flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all',
                  theme === 'light' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400')}
              >
                <Sun className="h-4 w-4" /> Light
                {theme === 'light' && <Check className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn('flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all',
                  theme === 'dark' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400')}
              >
                <Moon className="h-4 w-4" /> Dark
                {theme === 'dark' && <Check className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Security</h3>
          </div>
          <button className="btn-secondary w-full" onClick={() => setPasswordModal(true)}>
            <Lock className="h-4 w-4" /> Change Password
          </button>
        </div>

        {/* Notifications */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Enable notifications</span>
            <button
              onClick={() => setNotifications(!notifications)}
              className={cn('relative h-6 w-11 rounded-full transition-colors', notifications ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600')}
            >
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform', notifications ? 'left-5' : 'left-0.5')} />
            </button>
          </label>
        </div>

        {/* Data Management */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Data Management</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="btn-secondary justify-start" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export All Data
            </button>
            <button className="btn-secondary justify-start" onClick={() => setImportModal(true)}>
              <Upload className="h-4 w-4" /> Import Data
            </button>
          </div>
          {exportData && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">Last export preview:</p>
              <pre className="max-h-32 overflow-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-900/50">{exportData.slice(0, 500)}...</pre>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <LogOut className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Account</h3>
          </div>
          <button className="btn-danger" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      <Modal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
        title="Change Password"
        footer={<><button className="btn-secondary" onClick={() => setPasswordModal(false)}>Cancel</button><button className="btn-primary" onClick={changePassword}>Update Password</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input type="password" className="input" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        open={importModal}
        onClose={() => setImportModal(false)}
        title="Import Data"
        footer={<><button className="btn-secondary" onClick={() => setImportModal(false)}>Cancel</button><button className="btn-primary" onClick={handleImport}>Import</button></>}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Paste your exported JSON data below to import records into your account.</p>
          <textarea
            className="input min-h-[200px] resize-y font-mono text-xs"
            placeholder='{"notes": [...], "tasks": [...], ...}'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
