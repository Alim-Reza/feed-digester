export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const runStatusVariant: Record<string, BadgeVariant> = {
  succeeded: 'default',
  failed: 'destructive',
  running: 'secondary',
  queued: 'outline',
  awaiting_user: 'secondary',
  interrupted: 'outline',
};

export const runEventLevelVariant: Record<string, BadgeVariant> = {
  error: 'destructive',
  warn: 'secondary',
  info: 'outline',
  debug: 'outline',
};
