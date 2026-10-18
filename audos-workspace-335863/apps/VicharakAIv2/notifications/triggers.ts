/**
 * The 6 notification triggers (§9). Evaluated on app open and every minute
 * while the app runs. Every trigger:
 *   - requires onboarding complete + explicit opt-in (except the install
 *     prompt, which is an in-app banner, not a notification),
 *   - fires at most once per its window (per day / per week / once ever).
 */
import { getProfile } from '../data/kv';
import { getNotifPrefs, saveNotifPrefs, notify } from './notify';
import { listStudyTasks } from '../data/tasks';
import { listDoubts } from '../data/doubts';
import { buildTodayView } from '../engine/scheduler';
import { planTodaysReviews } from '../engine/backlog';
import { todayIso, diffDays } from '../lib/dates';

async function firedToday(key: string): Promise<boolean> {
  const prefs = await getNotifPrefs();
  return prefs.lastFired[key] === todayIso();
}

async function markFired(key: string): Promise<void> {
  const prefs = await getNotifPrefs();
  prefs.lastFired[key] = todayIso();
  await saveNotifPrefs(prefs);
}

export async function evaluateTriggers(): Promise<void> {
  const profile = await getProfile();
  if (!profile.onboarding_complete || !profile.exam_id) return; // never pre-onboarding (§9)
  const prefs = await getNotifPrefs();
  if (!prefs.enabled) return; // opt-in only (§9)

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const examId = profile.exam_id;

  // 1. Daily study reminder at the user-set time.
  if (hhmm >= prefs.dailyTime && !(await firedToday('daily'))) {
    await notify('Study time', "Open today's plan — small consistent sessions beat cramming.");
    await markFired('daily');
  }

  // 2. Revision due reminder (once per day, only when something is due).
  if (!(await firedToday('revision'))) {
    const view = await buildTodayView(examId);
    const dueDoubts = await planTodaysReviews(await listDoubts(examId));
    const due = view.revisionsDue.length + dueDoubts.length;
    if (due > 0) {
      await notify('Revision due', `${due} item${due === 1 ? '' : 's'} to review today — takes just a few minutes.`);
      await markFired('revision');
    }
  }

  // 3. "You haven't logged anything today" — evening, gentle.
  if (now.getHours() >= 20 && !(await firedToday('no_log'))) {
    const tasks = await listStudyTasks(examId);
    const doubts = await listDoubts(examId);
    const today = todayIso();
    const loggedToday =
      tasks.some((t) => t.completed_at?.slice(0, 10) === today) ||
      doubts.some((d) => d.created_at.slice(0, 10) === today);
    if (!loggedToday) {
      await notify('Nothing logged yet', 'Even ticking off one small task keeps the streak alive.');
      await markFired('no_log');
    }
  }

  // 4. "You're behind pace" — at most weekly.
  const lastPace = prefs.lastFired['pace'];
  if (!lastPace || diffDays(lastPace, todayIso()) >= 7) {
    const { computePaceSignal, remainingEstHoursForExam } = await import('../engine/pace');
    const signal = await computePaceSignal({
      examDate: profile.exam_date,
      remainingEstHours: await remainingEstHoursForExam(examId),
    });
    if (signal.level === 'amber' || signal.level === 'red') {
      await notify('Pace check', 'You are running behind plan — open Today to rebalance.');
      await markFired('pace');
    }
  }

  // 5. Onboarding nudge — day 2, only if no doubts were ever uploaded, once.
  if (!prefs.lastFired['nudge'] && profile.onboarding_completed_at) {
    const daysSince = diffDays(profile.onboarding_completed_at.slice(0, 10), todayIso());
    if (daysSince >= 1) {
      const doubts = await listDoubts(examId);
      if (doubts.length === 0) {
        await notify('Try the Mistake Book', 'Photograph one wrong question — the app schedules it back before you forget.');
      }
      await markFired('nudge'); // marked either way: this nudge is once-ever
    }
  }

  // 6. Homescreen/install prompt is an in-app banner (pwa/install.ts), not a
  //    push — browsers require a user gesture for install anyway.
}
