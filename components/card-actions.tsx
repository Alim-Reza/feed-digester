'use client';

import { useState } from 'react';
import { Bookmark, EyeOff, ExternalLink } from 'lucide-react';
import { cn } from 'cn';

/**
 * The card's bottom-right icon row (save / hide / open) from docs/image.png. Per
 * docs/ui-redesign-handoff.md §2: rendered for visual fidelity only — save/hide are ephemeral,
 * client-side-only state with no persistence (the `feedback` table is keyed by `postId`, not by
 * insight, so there is no clean existing write path for "save this insight" — inventing one would
 * be new backend surface this task explicitly avoids). Refreshing the page resets them.
 */
export function CardActions({ openUrl }: { openUrl: string | null }) {
  const [saved, setSaved] = useState(false);
  const [hidden, setHidden] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? 'Unsave insight' : 'Save insight'}
        onClick={() => setSaved((v) => !v)}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md transition-colors',
          saved
            ? 'text-accent-signal'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Bookmark className={cn('size-4', saved && 'fill-current')} />
      </button>
      <button
        type="button"
        aria-pressed={hidden}
        aria-label={hidden ? 'Unhide insight' : 'Mark as not useful'}
        onClick={() => setHidden((v) => !v)}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md transition-colors',
          hidden ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <EyeOff className="size-4" />
      </button>
      {openUrl && (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open source on LinkedIn"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}
