<!-- Draft — 152 words. Replace [link] with the published blog URL before posting. -->

I built a tool that reads my LinkedIn feed so I don't have to.

It logs into a dedicated account, scrolls like a human, filters the noise, classifies and
clusters what's left, and writes me a short daily digest instead of an infinite scroll — plus a
"Job Market" section that pulls company/role/skills straight out of hiring posts.

The interesting part wasn't the scraping. It was building this end-to-end with Claude Code doing
the actual coding: a spec, three rounds of the agent interrogating my assumptions, twelve
implementation slices, and two real bugs found only after everything was "done" — a build that
silently froze live data into static HTML, and a scheduler that retry-stormed for an hour because
a safety setting had been sitting in config, declared but never actually wired up, since day one.

Wrote up the full build — architecture, the classifier bake-off, what broke and why — here:
[link]
