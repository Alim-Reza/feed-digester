'use server';

import { revalidatePath } from 'next/cache';
import { getWebContext } from '@/src/web/context';
import type { FeedbackKind } from '@/src/db/schema';

/** 👍/👎 quick feedback (grill D6) — bound with (postId, kind) from the form action. */
export async function submitFeedback(postId: string, kind: FeedbackKind, _formData: FormData) {
  void _formData; // required so Next can pass the submitting <form>'s FormData as the bound action's last arg
  const { repos } = getWebContext();
  repos.feedback.add({ postId, kind });
  revalidatePath('/posts');
}

/** Ground-truth label for the ADR 0003 classifier bake-off (grill E5) — bound with (postId). */
export async function submitLabel(postId: string, formData: FormData) {
  const { repos } = getWebContext();
  const categories = formData.getAll('categories').map(String);
  const relevance = Number(formData.get('relevance') ?? 0);
  repos.feedback.add({ postId, kind: 'label', value: { categories, relevance } });
  revalidatePath('/posts');
}
