import type { Metadata } from 'next';
import Script from 'next/script';
import { Space_Grotesk, DM_Sans, Geist_Mono } from 'next/font/google';
import { AppHeader } from '@/components/app-header';
import { getWebContext } from '@/src/web/context';
import { formatRelativeTime } from '@/src/web/relativeTime';
import './globals.css';

// Headings/display (Space Grotesk) + body/utility (DM Sans) — the "Signal Brief" reference's own
// pairing (docs/ui-redesign-handoff.md), wired to Tailwind's `font-heading`/`font-sans` utilities
// via the `--font-space-grotesk`/`--font-dm-sans` variables below (see app/globals.css).
const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Feed Digester',
  description: 'A local-first LinkedIn feed digester.',
};

// The header reads live DB state (last succeeded run) on every request — must not be statically
// prerendered, same reasoning as every data-reading page under it.
export const dynamic = 'force-dynamic';

// Applied before hydration (next/script's beforeInteractive) so the page never flashes the
// wrong theme — reads a stored choice, defaults to dark (grill I5) since the "Signal Brief"
// reference design (docs/image.png/docs/image-1.png) has no designed light variant; an explicit
// stored 'light' choice from the theme toggle is still honored.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored !== 'light';
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

function getStatusLabel(): string {
  const { repos } = getWebContext();
  const lastSucceeded = repos.runs.listRecentSucceeded(1)[0];
  if (!lastSucceeded?.finishedAt) return 'No successful run yet';
  return `Local index updated ${formatRelativeTime(lastSucceeded.finishedAt)}`;
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const statusLabel = getStatusLabel();
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <AppHeader statusLabel={statusLabel} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
