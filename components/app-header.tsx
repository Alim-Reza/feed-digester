import Link from 'next/link';
import { Clock, SlidersHorizontal } from 'lucide-react';
import { NavPills } from '@/components/nav-pills';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * The reference design's header chrome (docs/image.png / docs/image-1.png): logo mark + wordmark,
 * pill nav, right-aligned status text + a settings icon. Global (in `app/layout.tsx`) so it's
 * consistent across every page, per docs/ui-redesign-handoff.md §2 rule 2.
 */
export function AppHeader({ statusLabel }: { statusLabel: string }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent-signal text-sm font-bold text-accent-signal-foreground">
              S
            </span>
            <span className="font-heading text-base font-bold tracking-tight">Signal Brief</span>
          </Link>
          <NavPills />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
            <Clock className="size-3.5" />
            {statusLabel}
          </span>
          <Link
            href="/operations"
            aria-label="Operations"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SlidersHorizontal className="size-4" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
