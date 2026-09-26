'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, LayoutList, Radio, Settings2, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';

/**
 * The reference design's pill nav (docs/image.png): the app's real top-level pages, per the
 * user's own scope ruling (docs/ui-redesign-handoff.md §2) — no invented "Jobs"/"Saved" routes.
 * "Briefing" is `/`, which already redirects to the latest digest detail page (the screen the
 * reference calls "Today's Briefing"); "Digests" is the historical list at `/digests`.
 */
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; isActive: (path: string) => boolean }[] = [
  {
    href: '/',
    label: 'Briefing',
    icon: Radio,
    isActive: (path) => path === '/' || /^\/digests\/[^/]+/.test(path),
  },
  {
    href: '/digests',
    label: 'Digests',
    icon: LayoutList,
    isActive: (path) => path === '/digests',
  },
  {
    href: '/operations',
    label: 'Operations',
    icon: Settings2,
    isActive: (path) => path.startsWith('/operations'),
  },
  {
    href: '/posts',
    label: 'Posts',
    icon: FileText,
    isActive: (path) => path.startsWith('/posts'),
  },
];

export function NavPills() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-accent-signal text-accent-signal-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
