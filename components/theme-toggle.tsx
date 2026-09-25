'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

// No React state: the `dark:` Tailwind variant already switches on the `.dark` class the
// beforeInteractive script applies before hydration, so swapping icons via CSS avoids a
// server/client render mismatch entirely.
function toggleTheme() {
  const next = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', next);
  try {
    localStorage.setItem('theme', next ? 'dark' : 'light');
  } catch {
    // best-effort — a private window or blocked storage just won't persist the choice
  }
}

export function ThemeToggle() {
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={toggleTheme}>
      <Sun className="hidden size-4 dark:inline" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
