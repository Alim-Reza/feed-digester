'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from 'cn';

/**
 * The insight-detail page's "Save" / "Not useful" buttons (docs/image-1.png). Same non-goal as
 * `CardActions`: ephemeral client-only state, no persistence — see its comment for why.
 */
export function InsightActions() {
  const [saved, setSaved] = useState(false);
  const [notUseful, setNotUseful] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        aria-pressed={saved}
        onClick={() => setSaved((v) => !v)}
        className={cn(
          'gap-1.5 bg-accent-signal text-accent-signal-foreground hover:bg-accent-signal/85',
          saved && 'ring-2 ring-accent-signal/40',
        )}
      >
        <Bookmark className={cn('size-4', saved && 'fill-current')} />
        {saved ? 'Saved' : 'Save'}
      </Button>
      <Button
        type="button"
        variant="outline"
        aria-pressed={notUseful}
        onClick={() => setNotUseful((v) => !v)}
        className={cn(notUseful && 'bg-muted text-foreground')}
      >
        {notUseful ? 'Marked not useful' : 'Not useful'}
      </Button>
    </div>
  );
}
