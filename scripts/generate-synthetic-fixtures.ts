/**
 * Populates tests/fixtures/linkedin/ with hand-built HTML that mirrors LinkedIn's real post
 * markup as confirmed via `pnpm diagnose:feed` on 2026-09-25 (see src/collector/parse/
 * selectors.ts and docs/plan.md slice 3): `[role="listitem"]` containers, hashed/atomic CSS
 * classes (ignored by the parser), author name from a "Hide post by <Name>" aria-label,
 * headline/timestamp as sibling <p> elements, and post text in
 * `[data-testid="expandable-text-box"]`. These synthetic fixtures fill in shapes the one
 * real capture session didn't happen to show (sponsored, reposts, polls) — best-effort,
 * unverified against real markup; correct them if a real capture proves them wrong.
 */
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'linkedin');

type Variant = {
  id: string;
  authorName: string;
  authorHeadline?: string;
  connectionDegree?: string; // e.g. "3rd+", "1st" — rendered as "• <degree>"
  socialProof?: string; // e.g. "Jane Doe and 3 others like this"
  via?: string; // reposter name
  text: string;
  seeMore?: boolean;
  sponsored?: boolean;
  hasVideo?: boolean;
  timestampText?: string;
  connectionSuggestion?: boolean;
  /** Embeds a nested comment componentkey carrying an activity id, like a real post with >=1 comment. */
  withCommentActivityId?: string;
};

function actorParagraphs(v: Variant): string {
  const parts: string[] = [];
  if (v.socialProof) parts.push(`<p><span>${v.socialProof}</span></p>`);
  parts.push(`<p><span>${v.authorName}</span></p>`);
  if (v.connectionDegree) parts.push(`<p><span>• ${v.connectionDegree}</span></p>`);
  if (v.authorHeadline) parts.push(`<p><span>${v.authorHeadline}</span></p>`);
  parts.push(`<p><span>${v.timestampText ?? '3d'} •</span></p>`);
  if (v.sponsored) parts.push(`<p><span>Promoted</span></p>`);
  return parts.join('\n  ');
}

function buildPostHtml(v: Variant): string {
  const slug = v.authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `<div role="listitem">
  ${v.via ? `<p><span>${v.via} reposted this</span></p>` : ''}
  ${v.connectionSuggestion ? `<p><span>People you may know</span></p>` : ''}
  ${actorParagraphs(v)}
  <button aria-label="Open control menu for post by ${v.authorName}"></button>
  <button aria-label="Hide post by ${v.authorName}"></button>
  <a href="https://www.linkedin.com/in/${slug}/"></a>
  <p><span data-testid="expandable-text-box">${v.text}</span></p>
  ${v.seeMore ? `<button data-testid="expandable-text-button">…see more</button>` : ''}
  ${v.hasVideo ? `<video src="blob:https://www.linkedin.com/example"></video>` : ''}
  ${
    v.withCommentActivityId
      ? `<div componentkey="replaceableComment_urn:li:comment:(activity:${v.withCommentActivityId},999)"></div>`
      : ''
  }
</div>`;
}

const variants: Variant[] = [
  {
    id: 'text-basic',
    authorName: 'Ada Lovelace',
    authorHeadline: 'Software Engineer',
    connectionDegree: '2nd',
    text: 'Excited to share a new project I shipped this week using TypeScript and Rust.',
    withCommentActivityId: '7500000000000000000',
  },
  {
    id: 'text-long-seemore',
    authorName: 'Grace Hopper',
    authorHeadline: 'Compiler enthusiast',
    text: 'A very long post about debugging '.repeat(20),
    seeMore: true,
    timestampText: '6h',
  },
  {
    id: 'sponsored-post',
    authorName: 'Acme Corp',
    authorHeadline: 'Software company',
    text: 'Check out our new product launch!',
    sponsored: true,
    timestampText: '2h',
  },
  {
    id: 'repost-with-via',
    authorName: 'Original Author',
    authorHeadline: 'Engineer',
    via: 'Jane Doe',
    text: 'Original post content being reposted.',
    timestampText: '5h',
  },
  {
    id: 'poll-post',
    authorName: 'Poll Person',
    text: 'What is your favorite language?',
    timestampText: '1d',
  },
  {
    id: 'video-post',
    authorName: 'Video Person',
    text: 'Check out this demo video.',
    hasVideo: true,
    timestampText: '2d',
  },
  {
    id: 'image-post',
    authorName: 'Image Person',
    text: 'A picture from the conference.',
    timestampText: '4h',
  },
  {
    id: 'article-share',
    authorName: 'Article Sharer',
    text: 'Great read on distributed systems.',
    timestampText: '1w',
  },
  {
    id: 'document-carousel',
    authorName: 'Doc Person',
    text: 'My slides from the talk.',
    timestampText: '9h',
  },
  {
    id: 'connection-suggestion',
    authorName: 'Suggested Person',
    text: '',
    connectionSuggestion: true,
  },
  {
    id: 'no-urn-hash-fallback',
    authorName: 'No Urn Author',
    text: 'This post has no recoverable activity id at all.',
    timestampText: '3d',
  },
  {
    id: 'bangla-content',
    authorName: 'রহিম উদ্দিন',
    authorHeadline: 'সফটওয়্যার ইঞ্জিনিয়ার',
    text: 'আজ আমি একটি নতুন প্রকল্প শুরু করেছি।',
    timestampText: '10h',
  },
  {
    id: 'celebration-humblebrag',
    authorName: 'Proud Person',
    text: "I'm thrilled to announce that I've started a new position!",
    timestampText: '3d',
  },
  {
    id: 'career-advice',
    authorName: 'Career Coach',
    authorHeadline: 'Career coach',
    text: 'Five tips for negotiating your next offer.',
    timestampText: '12h',
  },
  {
    id: 'engineering-leadership',
    authorName: 'Eng Manager',
    authorHeadline: 'VP Engineering',
    text: 'How we built a culture of ownership on our team.',
    timestampText: '30h',
  },
  {
    id: 'industry-news',
    authorName: 'Tech Reporter',
    text: 'Big funding round announced for a promising startup today.',
    timestampText: '5d',
  },
  {
    id: 'job-opening',
    authorName: 'Recruiter Jane',
    authorHeadline: 'Technical Recruiter',
    text: 'We are hiring a Senior Backend Engineer, remote, US timezones. Apply now!',
    timestampText: '2d',
  },
  {
    id: 'ai-ml-post',
    authorName: 'ML Researcher',
    authorHeadline: 'AI Researcher',
    text: 'New paper on efficient fine-tuning of LLMs just dropped.',
    timestampText: '15h',
  },
  {
    id: 'relative-time-seconds',
    authorName: 'Fresh Poster',
    text: 'Just posted this.',
    timestampText: 'Just now',
  },
  {
    id: 'relative-time-minutes',
    authorName: 'Minute Poster',
    text: 'Posted a few minutes ago.',
    timestampText: '45m',
  },
  {
    id: 'relative-time-hours',
    authorName: 'Hour Poster',
    text: 'Posted a few hours ago.',
    timestampText: '5h',
  },
  {
    id: 'relative-time-days',
    authorName: 'Day Poster',
    text: 'Posted a few days ago.',
    timestampText: '4d',
  },
  {
    id: 'relative-time-weeks',
    authorName: 'Week Poster',
    text: 'Posted a couple weeks ago.',
    timestampText: '2w',
  },
  {
    id: 'relative-time-months',
    authorName: 'Month Poster',
    text: 'Posted months ago.',
    timestampText: '5mo',
  },
  {
    id: 'relative-time-years',
    authorName: 'Year Poster',
    text: 'Posted a year ago.',
    timestampText: '1yr',
  },
  {
    id: 'empty-headline',
    authorName: 'No Headline',
    text: 'A post from someone with no visible headline.',
    timestampText: '1h',
  },
  {
    id: 'short-video-little-text',
    authorName: 'Terse Video',
    text: 'wow',
    hasVideo: true,
    timestampText: '1h',
  },
  {
    id: 'multi-paragraph-text',
    authorName: 'Verbose Author',
    text: 'First paragraph of thoughts. Second paragraph with more detail. Third paragraph wrapping up.',
    timestampText: '20h',
  },
  {
    id: 'emoji-and-hashtags',
    authorName: 'Emoji User',
    text: 'Loving the new release! 🚀🔥 #engineering #shipit',
    timestampText: '3h',
  },
  {
    id: 'sponsored-poll',
    authorName: 'Sponsor Co',
    text: 'Vote in our sponsored poll!',
    sponsored: true,
    timestampText: '1h',
  },
  {
    id: 'repost-no-original-urn',
    authorName: 'Original No Urn',
    via: 'Reposter Name',
    text: 'A reposted item with no recoverable activity id.',
    timestampText: '4d',
  },
  {
    id: 'long-headline',
    authorName: 'Titled Person',
    authorHeadline: 'Staff Software Engineer | Distributed Systems | Ex-Google | Speaker | Author',
    text: 'On distributed consensus.',
    timestampText: '8h',
  },
  {
    id: 'social-proof-before-name',
    authorName: 'Popular Poster',
    authorHeadline: 'Well-known headline',
    socialProof: 'Jane Doe and 3 others like this',
    text: 'A post whose actor block is preceded by a "likes this" social-proof line.',
    timestampText: '2h',
  },
];

fs.mkdirSync(FIXTURES_DIR, { recursive: true });
let written = 0;
for (const v of variants) {
  const filePath = path.join(FIXTURES_DIR, `${v.id}.html`);
  fs.writeFileSync(filePath, buildPostHtml(v), 'utf8');
  written += 1;
}
console.log(
  `Wrote ${written} synthetic fixtures to ${path.relative(process.cwd(), FIXTURES_DIR)}/`,
);
