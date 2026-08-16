import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { todayISO } from '@/lib/utils';

/**
 * Background automation engine — runs on an interval to:
 * 1. Mark tasks as overdue when their due date has passed
 * 2. Generate recurring task instances that are due
 * 3. Notify about upcoming reminders
 * 4. Notify about expiring documents
 * 5. Notify about approaching deadlines
 */
export function useAutomation() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const lastReminderCheck = useRef<string>('');

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const runAutomation = async () => {
      if (cancelled || !user) return;
      const today = todayISO();

      // 1. Mark overdue tasks
      await supabase
        .from('tasks')
        .update({ status: 'overdue' })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .lt('due_date', today);

      // 2. Generate recurring tasks
      const { data: recurringTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('recurring', 'none')
        .eq('status', 'completed');

      if (recurringTasks && recurringTasks.length > 0) {
        for (const task of recurringTasks) {
          if (!task.due_date) continue;
          const dueDate = new Date(task.due_date);
          const nextDue = new Date(dueDate);
          switch (task.recurring) {
            case 'daily': nextDue.setDate(nextDue.getDate() + 1); break;
            case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break;
            case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break;
            case 'yearly': nextDue.setFullYear(nextDue.getFullYear() + 1); break;
          }
          const nextDueStr = nextDue.toISOString().slice(0, 10);
          if (nextDueStr <= today) {
            await supabase.from('tasks').insert({
              user_id: user.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: 'pending',
              due_date: nextDueStr,
              due_time: task.due_time,
              recurring: task.recurring,
              category: task.category,
            });
            // Reset original task to pending with new due date
            await supabase.from('tasks').update({ status: 'pending', due_date: nextDueStr }).eq('id', task.id);
          }
        }
      }

      // 3. Check reminders (only once per day to avoid spam)
      if (lastReminderCheck.current !== today) {
        lastReminderCheck.current = today;
        const { data: dueReminders } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .eq('completed', false)
          .eq('reminder_date', today);

        if (dueReminders && dueReminders.length > 0) {
          for (const r of dueReminders.slice(0, 3)) {
            notify(`Reminder: ${r.title}`, 'info');
          }
        }

        // 4. Check expiring documents (within 30 days)
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
        const thirtyDaysStr = thirtyDaysLater.toISOString().slice(0, 10);
        const { data: expiringDocs } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .eq('archived', false)
          .gte('expiry_date', today)
          .lte('expiry_date', thirtyDaysStr);

        if (expiringDocs && expiringDocs.length > 0) {
          for (const d of expiringDocs.slice(0, 2)) {
            notify(`Document "${d.title}" expires soon`, 'info');
          }
        }

        // 5. Check approaching deadlines (tasks due within 3 days)
        const threeDaysLater = new Date();
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        const threeDaysStr = threeDaysLater.toISOString().slice(0, 10);
        const { data: upcomingTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'in_progress'])
          .gte('due_date', today)
          .lte('due_date', threeDaysStr);

        if (upcomingTasks && upcomingTasks.length > 0) {
          notify(`You have ${upcomingTasks.length} task(s) due within 3 days`, 'info');
        }
      }
    };

    runAutomation();
    const interval = setInterval(runAutomation, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, notify]);
}
