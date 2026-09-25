Based on the actual `content` field, **Gemma4 wins on classification quality**, but **Laya wins on relevance-score calibration**. If I had to pick one overall for your LinkedIn-feed use case, I’d choose **Gemma4**, then fix its relevance scoring.

Gemma4 is much better at identifying what the post is actually about. For example, the DSA interview-plan post is clearly career/interview content; Laya calls it `software_engineering`, while Gemma4 calls it `career`. Similarly, the oversized Scrum-team post is specifically engineering/team leadership; Gemma4 chooses `engineering_leadership`, while Laya chooses generic `software_engineering`. The internship-scam post is career-related; again Gemma4 identifies `career`, while Laya labels it `software_engineering`. :chatgpt-content-reference{index="0"}

This pattern repeats a lot. Of the 101 posts, the models disagree on the primary category **44 times**. In many of those disagreements, Gemma4's label is substantially more semantically aligned with the content. Laya has some particularly strange misses—for example, it labels a post about job security and choosing risky vs. stable employment as `industry_news`, whereas Gemma4 correctly recognizes the post as primarily `career`. :chatgpt-content-reference{index="1"}

Where **Laya is noticeably better is relevance**. Gemma4 is way too generous. Across the dataset:

| Metric | Laya | Gemma4 |
|---|---:|---:|
| Mean relevance | **0.581** | **0.791** |
| Median relevance | **0.613** | **0.880** |
| Posts ≥ 0.8 relevance | **1 / 101** | **65 / 101** |
| Posts < 0.3 relevance | **8 / 101** | **1 / 101** |

Gemma4 effectively says, *"almost everything is interesting."* That's dangerous for your project because your whole objective is to avoid doom-scrolling and aggressively filter the feed. For example, a one-line Favikon-ranking complaint gets `career / 0.8` from Gemma4, while Laya gives it only about `0.219`. Here Laya's interpretation of relevance is much closer to what you'd want from a feed distiller. :chatgpt-content-reference{index="2"}

There are also cases where Gemma4's category is right but its confidence/relevance is excessive. The DSA 30-day plan gets `career / 1.0`. That's definitely relevant to someone preparing for SWE interviews, but calling it **perfect 1.0 relevance** leaves essentially no room to distinguish it from an unusually valuable post tailored exactly to your interests. :chatgpt-content-reference{index="3"}

So my verdict for your specific pipeline is:

**Primary category accuracy → Gemma4 wins clearly.**  
**Relevance/filter calibration → Laya wins clearly.**  
**Overall → Gemma4 wins, roughly 65/35**, because wrong classification is harder to repair downstream than an overly enthusiastic score.

The strongest setup would actually be **Gemma4's semantic classification + a separate deterministic relevance function**. Don't ask Gemma4 for an unconstrained `0–1 relevance` number. Take its category scores and calculate relevance yourself, e.g. roughly:

```text
relevance =
  0.35 * software_engineering
+ 0.35 * ai_ml
+ 0.20 * career
+ 0.10 * engineering_leadership
```

Then add penalties/bonuses based on your preferences. That would preserve Gemma4's biggest advantage while removing its biggest weakness.

One more important observation: **Laya's scores look suspiciously compressed and correlated across unrelated categories**. For many posts it produces moderately high scores for *software engineering + AI + career + industry news simultaneously*. For example, the first post gets `0.75 SWE`, `0.68 AI`, `0.54 career`, `0.54 leadership`, and `0.63 industry_news`. Gemma4's distribution is much sharper and more interpretable. :chatgpt-content-reference{index="4"}

So for the system you're building, **I'd drop Laya as the classifier and keep Gemma4—but absolutely do not trust Gemma4's raw relevance score as your feed cutoff.**