/**
 * AppContext — the composition seam between the feature hooks and the
 * screens. AppShell assembles every feature ONCE and provides the controller;
 * screens read exactly the features they need via useApp(). No business
 * logic lives here.
 */
import { createContext, useContext } from 'react';
import type { VicharakTab } from '../ui';
import type { StudentData } from './StudentDataContext';
import type { ToastFeature } from '../shared/useToast';
import type { AccessFeature } from '../features/access/useAccess';
import type { PlanEngineFeature } from '../features/plan/usePlanEngine';
import type { MasteryFeature } from '../features/mastery/useMastery';
import type { TasksFeature } from '../features/tasks/useTasks';
import type { SyllabusActionsFeature } from '../features/syllabus/useSyllabusActions';
import type { DoubtsFeature } from '../features/doubts/useDoubts';
import type { TestsFeature } from '../features/tests/useTests';
import type { TestAnalysisFeature } from '../features/testAnalysis/useTestAnalysis';
import type { CoachFeature } from '../features/coach/useCoach';
import type { NotificationsFeature } from '../features/notifications/useNotifications';
import type { SettingsFeature } from '../features/profile/useSettings';
import type { OnboardingFeature } from '../features/onboarding/useOnboarding';

export interface AppController {
  data: StudentData;
  toast: ToastFeature;
  access: AccessFeature;
  plan: PlanEngineFeature;
  mastery: MasteryFeature;
  tasks: TasksFeature;
  syllabus: SyllabusActionsFeature;
  doubts: DoubtsFeature;
  tests: TestsFeature;
  analysis: TestAnalysisFeature;
  coach: CoachFeature;
  notifications: NotificationsFeature;
  settings: SettingsFeature;
  onboarding: OnboardingFeature;
  tab: VicharakTab;
  setTab: (tab: VicharakTab) => void;
}

const AppContext = createContext<AppController | null>(null);

export const AppContextProvider = AppContext.Provider;

export function useApp(): AppController {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppShell');
  return value;
}
