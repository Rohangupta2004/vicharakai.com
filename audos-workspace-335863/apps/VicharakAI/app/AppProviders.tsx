/**
 * AppProviders — theme + student-data providers around the shell.
 * The app's composition root (App.tsx) renders <AppProviders><AppShell/></...>.
 */
import type { ReactNode } from 'react';
import { VicharakThemeProvider } from '../ThemeContext';
import { SyllabusCatalogProvider } from '../data/syllabusRuntime';
import { StudentDataProvider } from './StudentDataContext';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <VicharakThemeProvider>
      <SyllabusCatalogProvider>
        <StudentDataProvider>{children}</StudentDataProvider>
      </SyllabusCatalogProvider>
    </VicharakThemeProvider>
  );
}
