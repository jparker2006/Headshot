# Is "a multiplayer harness for media with your friends" a company?

Research note, 12 September 2026. Commissioned to harden the Headshot vision with evidence:
is anyone doing this, is it a real company idea or a side project, and where consumer AI is going.

Method: web research, reading primary pages where they were reachable. Where a source was only
available through a search index or a secondary write-up, it is marked. Where a fact could not be
verified in this pass it says **not verified** rather than guessing. Two caveats on sourcing:
the session's web-search budget was exhausted part-way through, and several primaries
(openai.com, x.com, thestorygraph.com, justwatch.com, letterboxd.com/about) refuse automated
fetches behind Cloudflare. Those gaps are named in place.

Short quotations are under 15 words each and attributed.

---

## 1. Y Combinator's Requests for Startups

Source: <https://www.ycombinator.com/rfs> (read 11 Sep 2026). The current live list is the
**Fall 2026** batch of 13 items, published around **25 July 2026**.

The single most relevant fact in this entire note: **YC's current RFS list contains an item
literally titled "Multiplayer AI."**

### 1.1 "Multiplayer AI" — Aaron Epstein, YC partner (Fall 2026)

The argument is the Figma/Google Docs analogy applied to agents. YC's framing: the best work
tools of the last two decades won "by going multiplayer" — Docs beat Word, Figma beat Photoshop —
and AI "hasn't had its multiplayer moment yet."

The diagnosis: AI agents are the most powerful new tool a team has, but the one thing people
still use by themselves. You open a chat, type a prompt, get an answer "in a box only you can
see," and the best you can do to collaborate is send a read-only transcript.

What they want, verbatim from the RFS: *"Anyone on a team should be able to drop into the same
live agent session to watch it work, redirect it"* — and hand it off, the way they would with a
human teammate. The ask is for something "closer to Figma than a chat log." Named surfaces:
engineers coding together in real time, sales teams working a deal, support resolving a ticket,
lawyers drafting a contract, analysts building a model, marketers shipping a campaign.

**Important qualifier for Headshot: this RFS is entirely about work.** Every example is a
B2B workflow. YC is not asking for multiplayer consumer AI here.

Sources: <https://www.ycombinator.com/rfs>;
<https://modelence.com/yc-rfs-fall-2026>;
<https://explainx.ai/blog/yc-requests-for-startups-fall-2026> (25 Jul 2026).

### 1.2 "AI-Powered Consumer Products for 1 Billion People" — Raphael Schaad, YC visiting partner (Fall 2026)

The consumer item, and the second most relevant. Schaad (ex-Notion, Head of Design for Connected
Apps) argues that every platform shift creates new consumer giants, but three years into the AI
era **ChatGPT is still the only new icon on most people's home screens**.

The reasoning: intelligence has crossed the threshold where an agent can be treated like a
person, and the cost of running that agent is falling roughly **10× a year**, so nearly every
consumer category opens up again — education, health, finance, **entertainment**, transportation,
"and how we connect with each other."

Quoted: *"Whoever builds now, owns it"* and *"CONSUMER is going to be so back."*
The builder note in secondary coverage: *"Consumer AI wins on habit and distribution, not model
brand."*

**Entertainment and social connection are named categories.** This is the closest thing to an
invitation for Headshot in the current list. Note what it does *not* say: nothing about taste,
logging, recommendation, or groups of friends specifically.

Sources: <https://www.ycombinator.com/rfs>;
<https://digg.com/tech/ifcsbzzb>;
<https://explainx.ai/blog/yc-requests-for-startups-fall-2026>.

### 1.3 The rest of the Fall 2026 list (context for how consumer-shaped YC currently is)

The Primer (Andrew Miklas, adaptive child literacy/numeracy tutor — consumer-adjacent);
The Future of American Defense (Daniel P. Driscoll, US Secretary of the Army);
A Cloud for Small Software (Pete Koomen — *"Small software should be as easy to share with your
colleagues as a Google Doc"*); Multiplayer AI; Compute at Sea; AI-Powered Consumer Products for
1 Billion People; AI for the Aging Population; New Operating Systems for the Physical World;
The Best Time to Build in Crypto; Data for the Real World; Proving You're Human; AI-Native
Compliance Infrastructure; Self-Maintaining APIs.

Read as a whole, the list is overwhelmingly infrastructure and B2B. **Two of thirteen items touch
consumer.** Neither is about media, taste, or entertainment social.

### 1.4 Earlier editions — no media/taste item, ever

- **Summer 2026** (15 items): AI-Native Service Companies, Company Brain (Tom Blomfield),
  Dynamic Software Interfaces, Hardware Supply Chain, SaaS Challengers (Jared Friedman),
  Software for Agents (Aaron Epstein), selling to huge companies, semiconductors, the AI
  Operating System for Companies, low-pesticide agriculture (Garry Tan), AI Personalized
  Medicine, Counter-Swarm Defense, Electronics in Space, Industrial Capabilities in Space,
  Inference Chips for Agent Workflows. **Zero consumer items.**
- **Spring 2026** (8 items): Cursor for Product Managers, AI-Native Hedge Funds, AI-Native
  Agencies, Stablecoin Financial Services, AI for Government, Modern Metal Mills, AI Guidance
  for Physical Work, Infra for Government Fraud Hunters. **Zero consumer items.**
- **2025 extended list**: the nearest relative is **"AI Personal Staff for Everyone"** — personal
  AI assistants democratised, in the spirit of "software gives everyone what only the wealthy
  had." Others: a secure AI App Store, Datacenters, Compliance and Audit, Docusign 2.0, Browser
  & Computer Automation, Devtools for AI Agents, The Future of Software Engineering, AI
  Commercial Open Source, B2A (customers are agents), Vertical AI Agents, Inference
  Infrastructure. **Still no media, taste, or entertainment item.**

Sources: <https://modelence.com/yc-rfs-summer-2026>; <https://modelence.com/yc-rfs-spring-2026>;
<https://www.vccafe.com/extended-requests-for-startups-2025-list/>.

**Read of item 1.** YC has said, in writing, in the current cycle, that it wants (a) multiplayer
AI and (b) consumer AI including entertainment. It has never once asked for what Headshot is.
That cuts both ways: the thesis words are validated at the highest-profile source in the
industry, and the specific product is not on anybody's list.

---

## 2. "Multiplayer," "harness," and "multiplayer harness" — how the money actually uses these words

The headline: these are **two different vocabularies that fused in mid-2026**, and the fused
phrase currently means something Headshot is not.

### 2.1 "Harness" = engineering scaffolding, not social

"Agent harness" means the software wrapper around a model — tool dispatch, context management,
memory, permissions, sandbox, loop control. Its opposite is "raw model," not "single player."
The community formulation is *"Agent = Model + Harness"* (Hugging Face agent glossary, Sergio
Paniego and Aritra Roy Gosthipaty, **25 May 2026**,
<https://huggingface.co/blog/agent-glossary>).

Timeline of the term:
- **5 Jan 2026** — Philipp Schmid, "The importance of Agent Harness in 2026": *"It is not the
  agent itself. It is the software system that governs how the agent operates."*
  <https://www.philschmid.de/agent-harness-2026>
- **14 Jan 2026** — Sequoia, Pat Grady and Sonya Huang, "2026: This is AGI":
  *"Designing great agent harnesses is the domain of the application layer,"* and as a
  diligence question, *"Are you obsessively improving your agent harness?"*
  <https://sequoiacap.com/article/2026-this-is-agi>. **This essay never uses "multiplayer."**
- **~11 Apr 2026** — Garry Tan, "Thin Harness, Fat Skills": a harness should *"run the model in
  a loop, read and write files, manage context, and enforce safety,"* against fat harnesses with
  40+ tool definitions eating context. <https://x.com/garrytan/status/2042925773300908103>
  (tweet text via search index; verify verbatim before quoting publicly).
- **21 Aug 2026** — Nvidia's Adel El Hallak via TechCrunch: the harness is *"the scaffolding
  around the model, which we call the harness"*; headline claim is that the harness, not the
  model, is the hero.
  <https://techcrunch.com/2026/08/21/nvidia-just-showed-that-the-harness-not-the-ai-model-is-now-the-real-hero/>
- Microsoft shipped "Agent Harness" as a named primitive in Agent Framework at BUILD 2026.
  Lux Capital led a $6M round in Multiplier in Aug 2026 for "AI agent harnesses" for asset
  managers — the word is now a funding-copy category label.

Conviction/Sarah Guo is credited in a Feb 2026 RFS roundup with the theme **"Year of the Agent
Harness"** (<https://www.vccafe.com/2026/02/03/requests-for-startups-2026-edition/>, 3 Feb 2026,
updated 1 May 2026). I could not verify a primary Conviction post with that exact phrase —
**treat as secondary**.

### 2.2 "Multiplayer" = the Figma/Docs collaboration sense

Borrowed from gaming into SaaS well before AI. Northzone, "The Rise of Multiplayer Software"
(20 Jun 2023, <https://northzone.com/2023/06/20/perspectives-the-rise-of-multiplayer-software/>)
traces 1980s groupware → Google Docs (2006) → GitHub/Notion/Figma. The cohort is always cited
identically: Figma, Notion, Linear, Miro, Airtable, Docs.

The AI port, in order:
- **18 Dec 2025** — a16z Speedrun, Fareed Mosavat, "14 Big Ideas for 2026," idea #3, verbatim as
  a header: **"Multi-player AI will eat single-player AI."** Diagnosis: *"most AI tools are built
  for one human + one model in a private workspace."*
  <https://speedrun.substack.com/p/14-big-ideas-for-2026>
- **18 May 2026** — Dust raises $40M Series B explicitly on "multiplayer AI." CEO Gabriel
  Hubert: humans and agents *"become true collaborators… This is what we call multiplayer AI."*
  Mechanism claim: *"the bottleneck shifts from generation to coordination."* Led by Abstract
  and Sequoia. <https://dust.tt/blog/series-b-multiplayer-ai>
- **18 May 2026** — Sequoia's Konstantine Buhler on that round, the sharpest VC formulation:
  *"Most enterprise AI today is single-player: one person, one prompt, no compounding."*
  Proof point cited: *"Zero churn and 70% weekly active usage."*
  <https://www.globenewswire.com/news-release/2026/05/18/3296726/0/en/dust-raises-40m-to-make-ai-multiplayer-inside-the-enterprise.html>
- **21 Jul 2026** — Jack Dorsey/Block launch **Buzz**, "a group chat platform for the workplace
  that puts humans and their AI agents in the same conversations."
  <https://techcrunch.com/2026/07/21/jack-dorsey-is-taking-on-slack-with-buzz-a-group-chat-platform-for-teams-and-their-ai-agents/>
- **25 Aug 2026** — Salesforce launches **Slack Code** "to make AI software development
  multiplayer." The Register's skeptical gloss (20 Aug 2026) is worth keeping: it is *"another
  way of saying the coding bot is leaving the developer's terminal and joining the group chat."*
- **4 Sep 2026** — Anthropic brings Claude into Slack, framed by trade press as multiplayer AI.

### 2.3 The fusion: YC's QM, 31 July 2026

This is where "multiplayer" and "harness" become one phrase.

YC open-sourced **QM**, described in product copy as *"a multiplayer agent harness for work,
running in Slack and on the web"* (MIT licence, TypeScript/Node, Postgres-backed, model-agnostic
— "Pi, OpenCode, Codex, and Claude Code all drive the same core"). Each person and each room
gets scoped memory, files, keychain view, permissions, crons, web apps and a durable sandbox;
collaboration happens in channels, group messages and projects **rather than by handing an agent
around**.

YC's own announcement (31 Jul 2026): a multi-agent harness used internally across "accounting,
legal, events, and engineering." Jared Friedman the same day, the single best quote joining both
senses: he uses QM daily *"as my primary agent harness for getting work done within YC,"* and
*"It's the first version of multi-player AI I've really seen work"* — because the work happens
in Slack channels where everyone can see it.

Pete Koomen (YC) states the conflation as a thesis in *Inside YC's AI Playbook*
(<https://www.ycombinator.com/library/Qh-inside-yc-s-ai-playbook>): we are still in the
"single player era of agents," harnesses have become popular, and **"the multiplayer harness"**
is the unsolved problem.

Garry Tan is reported to be building **Egregore**, "an open-source harness for multiplayer
knowledge work," on the reasoning that group systems compound faster than solo use because
context generation is a function of the communication around work. **Secondary sourcing only —
least verified claim in this note.**

Sources: <https://x.com/ycombinator/status/2083243960684908768>;
<https://www.marktechpost.com/2026/08/03/y-combinator-open-sources-qm-multiplayer-ai-agent-harness/>;
<https://ai-tldr.dev/tools/qm/>; <https://x.com/snowmaker/status/2083261973681373296>.

### 2.4 Consumer multiplayer AI is a much weaker thesis than enterprise multiplayer AI

This matters more than anything else in section 2.

- a16z's consumer team **does not use "multiplayer" as a thesis word.** Their flagship 2026
  consumer-AI bet, **Town** ($55M Series A, 3 Jun 2026, Alex Rampell and Justine Moore), is
  explicitly single-player: it "learns how you work and starts proactively pitching in."
  <https://a16z.com/announcement/investing-in-town/>
- The purest consumer instance is **Shapes** (29 Apr 2026): humans and AI in the same group
  chats, $8M seed led by Lightspeed, 400K+ MAU, 3M user-created characters. CEO Anushk Mittal:
  *"all of our conversations with AI are very private and one-on-one, but that's not really how
  humans collaborate."*
  <https://techcrunch.com/2026/04/29/meet-shapes-the-app-bringing-humans-and-ai-into-the-same-group-chats/>
- Character.AI shipped group chat in **Oct 2023**, predating the whole vocabulary. It has not
  become the thing Character.AI is known for.

**Read of item 2.** The words in Jake's sentence are hot, but they are hot in the *enterprise*.
"Multiplayer harness" as used by YC, Sequoia, Dust, Slack and Block means *a team's agents at
work*. Nobody with money is currently using it to mean *friends deciding what to watch*. Using
the phrase in a pitch will make a YC partner think you are building QM for companies. That is a
positioning problem, not a validation.

---

## 3. Consumer AI state of play, 2025–2026

### 3.1 a16z's Top 100 Gen AI Consumer Apps

Six editions, roughly every six months. Methodology is stable: top 50 AI-first **web** products
by unique monthly visits (Similarweb), top 50 AI-first **mobile** apps by MAU (Sensor Tower),
published as two separate lists, with a "Brink List" of near-misses since the 4th edition.

| Ed. | Date | URL |
|---|---|---|
| 1st | Sept 2023 | <https://a16z.com/how-are-consumers-using-generative-ai/> |
| 2nd | 13 Mar 2024 | <https://a16z.com/100-gen-ai-apps/> |
| 3rd | 21 Aug 2024 | <https://a16z.com/100-gen-ai-apps-3/> |
| 4th | 6 Mar 2025 | <https://a16z.com/100-gen-ai-apps-4/> |
| 5th | 27 Aug 2025 | <https://a16z.com/100-gen-ai-apps-5/> |
| 6th | 9 Mar 2026 | <https://a16z.com/100-gen-ai-apps-6/> |

A 7th edition does not exist yet (`/100-gen-ai-apps-7/` → 404, checked 11 Sep 2026); on cadence
one is overdue. Note the 6th edition **changed the inclusion rule** — from AI-native-only to any
consumer product where gen AI is core — which is why Canva, CapCut, Notion, Picsart and
Grammarly appear for the first time. It breaks the time series; account for it.

**6th edition (Jan 2026 data), the current picture:**
- Top 10 web: ChatGPT, Gemini, Claude, Perplexity, DeepSeek, Grok, Meta AI, Canva, CapCut,
  Hugging Face. Top 10 mobile: ChatGPT, Canva, CapCut, Gemini, Character.AI, DeepSeek, Picsart,
  Perplexity, Meitu, BeautyPlus.
- **ChatGPT 900M WAU**, +50% YoY. 2.7× Gemini on web, 2.5× on mobile MAU. Sessions per user
  2.2× Gemini on mobile.
- Paid subs (Yipit, Jan 2026): ChatGPT **8× Claude**, **4× Gemini**. Claude +200%+ YoY,
  Gemini +258% YoY. Both leaders show "best-in-class consumer paid subscriber retention."
- **Image generation collapsed from 7 web entries to 3** once GPT Image 1.5 and Nano Banana
  bundled it in. Midjourney went from top-10 in edition 1 to **#46**. Contrast: **ElevenLabs has
  appeared on every edition since Sept 2023** because voice stayed technically specialized.
  This is the single most useful published heuristic for *which verticals get eaten*.
- **Sora** — fastest app ever to 1M downloads, 20 days at #1 in the US App Store, ~3M mobile DAU
  — **fell off the mobile list entirely** within months. Day-30 retention was reported sub-8%.
  The cleanest published example of viral acquisition without retention.
- Notion's paid AI attach rate went **20% → >50%** in a year; AI is now roughly half of Notion's
  ARR. CapCut: 736M mobile MAU. Claude Code: $1B annualized run rate in six months.
- Olivia Moore's verdict, and the line most relevant to Headshot: **"no one has yet cracked
  AI x social."**

**Earlier editions, the durable findings:**
- Sept 2023: **90% of consumer AI products already monetized, averaging ~$21/month.** Bottom
  quartile got just 2% of traffic from paid acquisition vs ~70% for non-AI subscription apps —
  early consumer AI was organic-demand-driven.
- Mar 2024: **Character.AI ~2 hours average daily use, 298 mobile sessions per user per month.**
  Still the benchmark numbers for companion stickiness. Companions went 2 → 8 web entries;
  6 of 8 marketed as "uncensored."
- Mar 2025, the money finding: **only ~40% overlap between the top 50 mobile apps by MAU and the
  top 50 by revenue.** "The most popular apps don't always generate the most revenue."
  High-revenue categories with **zero** top-50 usage presence: plant ID (PictureThis),
  nutrition (Cal AI), language learning (Speak), music (Moises, Suno), dictation (Otter, PLAUD).
  This is the strongest published datapoint for the vertical-consumer-AI case.
- Aug 2025: ecosystem stabilizing (11 new web entrants vs 17). Grok went ~0 → ~20M mobile MAU,
  **+40% after the "Ani" companion avatars** (14 Jul 2025) — companion features moved a general
  assistant's numbers. A top vibe-coding platform showed **>100% revenue retention** in US
  cohorts for several months.

### 3.2 State of Consumer AI 2025 — the retention and concentration numbers

Olivia Moore and Justine Moore, **18 Dec 2025**,
<https://a16z.com/state-of-consumer-ai-2025-product-hits-misses-and-whats-next/>.

- **Fewer than 10% of ChatGPT's weekly users visited a competing assistant.** Only **9% of
  consumers pay for more than one** AI subscription.
- **ChatGPT DAU/MAU 36%**, nearly double Gemini's 21%. 36% is mainstream-social-app territory;
  ChatGPT is the exception in consumer AI, not the rule.
- **Month-12 retention**: ChatGPT free 50%, Gemini free 25%; ChatGPT paid 68%, Gemini paid 57%.
- Misses they name: OpenAI's **Pulse, Group Chats, Tasks and Study Mode** have **"not truly
  broken through."** Google's Portraits, Doppl, Whisk had "relatively muted traction."
- Their 2026 outlook nonetheless argues there is white space for startups building "dedicated
  consumer experiences," because *"Model companies don't have the intuition or resources to
  innovate outside core competency."*

### 3.3 The winner-take-most argument, and the rebuttal

For concentration: <10% cross-assistant usage; 9% multi-subscription; ~20% of ChatGPT web users
also used Gemini in a week; ChatGPT's 36% DAU/MAU and 50% month-12 retention roughly double
Gemini's; bundling demonstrably killed standalone image generation; ChatGPT's app directory
(220 apps across 13 categories, late Feb 2026) plus "Sign in with ChatGPT" positions it as the
default interface between consumers and the internet.

Against: **Anish Acharya, "Notes on AI Apps in 2026," 8 Jan 2026**
(<https://a16z.com/notes-on-ai-apps-in-2026/>) — the assumption that the apps layer gets subsumed
by models is *"a bad assumption."* His evidence: coding is the category most directly targeted by
the labs, and coding startups still generated **more than $1B of new revenue in 2025**.
Defensibility, per Acharya: multi-model orchestration, domain specialization, network effects.

**Bryan Kim, "7 Ways AI-Native Companies Can Improve User Retention," 7 May 2024**
(<https://a16z.com/7-ways-ai-native-companies-can-improve-retention/>) is the canonical retention
playbook: founders moved **N-Day D30 retention by 10–15 points** — the gap between okay and
great. Tactics: fast time-to-value, feature-gated onboarding that forces an aha moment, designed
reciprocity ("give to get" — create before you view), **user-sourced rather than company-sourced
notifications**, streaks, AI-generated activity recaps, and status/leaderboards for power users.
Note how many of those are social mechanics. The post does not publish absolute D30 thresholds —
**not verified**.

### 3.4 The retention numbers that actually decide this

This is the part that should change behaviour, so it gets the detail.

**Bryan Kim's consumer benchmark grid** ("Do You Have Lightning In a Bottle?", 3 Mar 2023,
<https://a16z.com/do-you-have-lightning-in-a-bottle-how-to-benchmark-your-social-app/>) — the
yardstick everything else is measured against:

| | OK | Good | Great |
|---|---|---|---|
| D1 | 50% | 60% | 70% |
| D7 | 35% | 40% | 50% |
| **D30** | **20%** | **25%** | **30%** |
| W1 / W4 | 40 / 20 | 55 / 30 | 75 / 50 |
| DAU/MAU | 25% | 40% | 50%+ |
| MoM growth | 20% | 35% | 50% |

Organic should be 80–90% of early acquisition. Note where ChatGPT lands: **36% DAU/MAU is
between "OK" and "Good" on a16z's own social grid, not "Great."** Gemini 21%, Grok 25%,
Meta AI ~16%. The best consumer AI product in the world is a mediocre social app by these lights.

**RevenueCat, "State of Subscription Apps 2026," 19 Mar 2026** — 115,000+ apps, $16B+ tracked
revenue, 1B+ transactions. The largest dataset published on the question:

| | AI apps | Non-AI |
|---|---|---|
| Annual-plan retention at 12 months | **21.1%** | **30.7%** |
| Monthly-plan at 12 months | 6.1% | 9.5% |
| Trial-to-paid conversion | **8.5%** | 5.6% |
| Install-to-paid | 2.4% | 2.0% |
| Realized LTV, monthly | **$18.92** | $13.59 |
| Realized LTV, annual year 1 | **$30.16** | $21.37 |
| Median refund rate | 4.2% | 3.5% |

**AI subscribers convert better and cancel ~30% faster.** RevenueCat's framing: AI sells, but it
doesn't stick. AI is 27.1% of all subscription apps; Photo & Video is 61.4% AI-powered. Other
useful benchmarks from the same report: hard paywalls convert ~5× better than freemium at D35
(10.7% vs 2.1%) with near-identical one-year retention; 17–32 day trials convert at 42.5% vs
25.5% for trials under four days.

**Menlo Ventures, "2025: The State of Consumer AI," 26 Jun 2025** (with Mode Mobile,
n=5,031 US adults):
- 61% of US adults used AI in the past six months; 19% daily. 1.7–1.8B global users.
- **A $12B consumer AI market built in ~2.5 years**, against a theoretical $432B. The gap is a
  **~3% free-to-paid conversion rate**. Even ChatGPT converts only ~5% of weekly actives.
- **81% of spend goes to general assistants; ~70% of all consumer AI spend goes to OpenAI.**
  Specialized tools are 18–20% of spend.

**Time per user is the starkest gap.** ChatGPT sits around **215 minutes per user per month
(~7 min/day)**. Social networks run 90+ min/day — roughly **13×**. The only consumer AI
engagement profile that beats social incumbents outright is **companions**: Character.AI's 298
sessions/month and ~2 hrs/day at peak. (Correct the folklore: the "2 hours" is daily time per
active user, not per session; per-visit average is 18m15s.)

**Unit economics.** RevenueCat's "The Hidden Cost of AI Features": subscription pricing assumes
near-zero marginal cost and LLM tokens break that — every regenerate is COGS. Track AI cost per
MAU and AI spend as a share of ARPU as first-class metrics. Secondary but directionally
corroborated: AI-native startups spend 20–40% of revenue on inference vs <10% infra for
traditional SaaS, and your most engaged users are your least profitable — the anti-network-effect.

**Revenue benchmarks** (Olivia Moore and Marc Andrusko, "What 'Working' Means in the Era of AI
Apps," 6 Jun 2025, <https://a16z.com/revenue-benchmarks-ai-apps/>): the median B2C gen-AI startup
hits **$4.2M ARR in year one**, Series A about 8 months after starting to monetize. Conversion to
paid is lower than pre-AI B2C; retention once converted is comparable.

### 3.5 Casualties and successes, with numbers

**Sora is the cautionary tale for anything that looks like "viral AI consumer app."** Fastest ever
to 1M downloads; 20 days at #1; peak 3.33M downloads Nov 2025; −32% MoM in December; −45% in
January 2026. Lifetime: **9.6M downloads, $1.4M consumer spend** — about **$0.15 revenue per
download**, roughly 8× worse than companion apps ($1.18). **OpenAI discontinued the Sora app on
24 March 2026.**

**Chegg** is the canonical kill: peak ~$14.5B market cap in early 2021 → ~$115M, roughly 99%
destroyed; FY2025 revenue $376.9M (−39%); layoffs of 22% then 45% (388 people, Oct 2025).
**Jasper**: $1.5B post-money in Oct 2022, one month before ChatGPT shipped; ARR ~$120M (2023) →
~$55M (2024); survived by pivoting to enterprise. **Character.AI**: valuation ~$2.5B → ~$1B after
the $2.7B Google licensing deal (Aug 2024); MAU 28M peak → ~20M; web traffic slid ~15% across
H1 2026 after the under-18 ban (announced 29 Oct 2025, fully enforced 24–25 Nov 2025) driven by
wrongful-death suits and an FTC 6(b) inquiry.

**Successes**: ElevenLabs entered 2026 at $350M ARR and crossed $500M within four months, driven
by *enterprise* conversational agents. Lovable did $1M → $100M ARR in 8 months. Cursor is >$2B
annualized at a $29.3B valuation — the definitive refutation of "wrapper ⇒ doomed," since it
began as a GPT-4/Claude wrapper. Claude Code: $1B annualized in six months, and invisible to
every consumer leaderboard.

**The uncomfortable pattern**: almost every surviving vertical AI win is *not consumer*.
ElevenLabs is enterprise agents, Cursor and Claude Code are dev tools, Jasper survived by going
Fortune 500. The 2026 risk to a consumer vertical is not that ChatGPT eats it — it is that the
category monetizes in enterprise and the consumer version never clears CAC after inference cost.

### 3.6 The aggregation argument, stated fairly

Ben Thompson has moved against consumer AI apps. "OpenAI's Windows Play" (Stratechery, 7 Oct
2025) reads the Apps SDK through the Microsoft/Windows lens: *"First a product must Aggregate
users and then it gets developers for free"* (Thompson), and *"the burden of making these
integrations work…will be on third party developers"* (Thompson). By "Agents Over Bubbles"
(16 Mar 2026) he argues *"the most compelling consumer applications of AI…are Google and Meta's
advertising businesses"* (Thompson). "Aggregators and AI" (Sept 2026): AI is a **sustaining**
technology for aggregators, not a disruptive one. That is the most recent word in the debate and
it is structurally bearish for standalone consumer AI apps.

Altimeter's Apoorv Agrawal ("The State of Consumer AI, Part 1: Usage," 2 Mar 2026): AI apps
crossed **1B weekly actives, with ChatGPT ~900M of that — roughly 70% of all AI WAU.** Each
quarter produced a challenger narrative (DeepSeek winter, Grok spring, Gemini summer); none
sustained. Notably he self-corrects: he had thought Google and Meta distribution would win, and
ChatGPT built its base "from scratch, without an existing distribution platform" (Agrawal).

Reality check on the Apps SDK, which matters for anyone considering ChatGPT as a distribution
channel: external checkout is still the default and the in-ChatGPT payment sheet is a private
beta. **Distribution is real; native monetization is not yet.**

**Read of item 3.** The money is in the assistants and in narrow, goal-directed verticals with
willingness to pay that never show up in usage rankings — a16z's March 2025 finding that only
~40% of the top-50-by-revenue apps overlap the top-50-by-MAU is the single most encouraging
datapoint for a small, opinionated product. But the retention data is brutal: AI subscription
apps retain 21.1% at twelve months against 30.7% for non-AI, only ~3% of consumers pay for AI at
all, and ChatGPT itself is a mediocre social app by a16z's own grid. Retention, not acquisition,
is the binding constraint. And the one category nobody has cracked — by a16z's own admission in
March 2026 — is AI × social.

---

## 4. Direct competitors and neighbours

### 4.1 Letterboxd — the incumbent, and the situation is unusually live

**What it is.** Film diary and social network: log films, rate 0.5–5 stars, review, build lists,
follow people. Founded Oct 2011 by Matthew Buchanan and Karl von Randow in Auckland; public
Feb 2013. **Movies only.**

**Traction** (registered members):

| Date | Members |
|---|---|
| 2020 | ~1.8M |
| Jan 2021 | 3M |
| Sept 2023 (Tiny deal) | 10M |
| Feb 2024 | 12M |
| Jun 2024 | 15M |
| End 2024 | 17M |
| May 2026 | 29M+ |
| **Jul 2026** | **30M+** |

That is roughly **+10M in twelve months** and **+146% since the acquisition**. ~700M ratings cast
in 2025 (Letterboxd Year in Review). Source: <https://en.wikipedia.org/wiki/Letterboxd>.

**Ownership and the sale.** Sept 2023: **Tiny** took a **60% stake at a ~$50–60M valuation**;
Buchanan and von Randow kept 20% each and still run it. **~26 April 2026**: Tiny is shopping the
stake, LionTree running the process; Semafor calls Letterboxd *"significantly undermonetized,"*
relying mostly on display/programmatic advertising, and reports Buchanan **retains veto rights
over any buyer**. **~10 July 2026**: the bidder list is reported as **Netflix, Sony Pictures,
Paramount Skydance, RedBird Capital, TPG** and **Alexis Ohanian**, at a floated **$250M
valuation** — 4–5× the 2023 mark in under three years — with significant public backlash to the
idea of Netflix owning it.
Sources: <https://www.semafor.com/article/04/26/2026/whats-next-for-letterboxd>;
<https://betakit.com/letterboxds-canadian-owner-reportedly-looking-to-sell/>;
<https://www.thewrap.com/industry-news/deals-ma/letterboxd-sale-netflix-sony-paramount/>;
<https://deadline.com/2026/07/letterboxd-sale-instrinsic-underdog-bidder-1236980779/>.

**Monetization.** Free tier, **Pro ($19/yr)**, Patron, HQ for organizations, display ads, studio
and festival partnerships, and since **10 Dec 2025** the **Letterboxd Video Store** — transactional
rentals of festival and undistributed films in 23 countries, on iOS/Android/Apple TV/Android TV.
Its explicit differentiator versus Apple and Amazon is *social*: you see friends' reviews before
you rent. Pro/Patron subscriber counts have never been published — **not verified**.
<https://techcrunch.com/2025/11/20/letterboxd-to-launch-new-movie-rental-feature-in-december>

**TV: announced September 2023, still not shipped.** Three years late. Semafor notes the TV
initiative "remains largely incomplete"; Letterboxd's help centre still says returning series are
unsupported (only miniseries, TV movies, historic exceptions); after the TV Time shutdown
Letterboxd publicly reconfirmed it is "still working on" TV. Buchanan has acknowledged community
controversy and promised to do it "in a way that doesn't disrupt the current experience."

**AI: none.** No native recommendation engine, no shipped AI feature, at 30M members. A
third-party ecosystem has grown to fill the hole — notably
<https://recommendations.victorverma.com/>, which sells recommendations *and* **film
compatibility with friends**. Claims elsewhere that Letterboxd "uses AI algorithms" have no
primary source and appear false.

**Multiplayer? Yes — it is the entire product.** But asymmetric social (follow, not mutual
friends), with **no algorithmic feed**. It reached 30M members without one.

### 4.2 TV Time — dead, July 2026, ~25M users evicted

The other headline. TV Time, the largest TV-tracking app in the world, **shut down permanently on
15 July 2026**, announced **2 July 2026** by parent **Whip Media**. All account data permanently
deleted on the shutdown date, with a GDPR export tool offered until then.

Scale at death: **26.4M+ lifetime installs**; Whip Media marketed "more than 25 million users."
Stated reason: no longer sustainable free, and "not enough demand for a paid app." Real reason
per TechCrunch: an AI pivot — **Blue Torch Capital** acquired Whip Media on 19 Feb 2025 and
envisioned "more of an AI-focused future"; the company redirected to **Helix**, an AI workflow
tool for streaming analytics. TechCrunch compared it to Mozilla killing Pocket.

TV Time was **partially multiplayer** — episode-level comment threads and reaction communities
were its distinguishing feature versus pure trackers.

Sources: <https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/>;
<https://en.wikipedia.org/wiki/Whip_Media>;
<https://www.techtimes.com/articles/319583/20260703/tv-time-closes-july-15-26-million-users-face-permanent-watch-history-deletion.htm>.

**This is the most actionable fact in the note.** Roughly 25M TV-logging users were made homeless
in July 2026, their data deleted, and the category leader still cannot log a TV show. Migration
guides sent them to Trakt, Serializd and Simkl. **No source published actual migration numbers —
not found.**

### 4.3 Serializd

"Letterboxd for TV," founded 2021, TMDB-backed, web + iOS + Android, **completely free** ("It
costs nothing to use any of its current features"), ad-supported, run by what appears to be a
solo or very small team. Self-description: *"It is to TV what Goodreads is to books, or
Letterboxd is to movies."* **Imports from TV Time and Trakt** — i.e. it was positioned exactly
for the July 2026 refugees. Features: episode diary, reviews and ratings, lists, follow friends,
see what friends are watching, member-generated recommendations. **Multiplayer: yes, social-graph
based. AI: none visible.** Funding and user numbers: **not found** (site read directly,
<https://www.serializd.com/>, 11 Sep 2026).

### 4.4 Trakt

Automatic scrobbling across streaming apps and media servers — the "never manually log anything"
approach, and the opposite philosophy to Letterboxd's deliberate diary. **Over 17M registered
accounts** (read directly from <https://trakt.tv/about>, 11 Sep 2026; "trakt, inc. 2010–2026").
VIP subscription tier. Has **personalized recommendations** ("based on your taste") and explicit
social framing — *"Follow friends, see what the team is watching"* and **"Watching together is
better."** Multiplayer: yes, lightly. AI: recommendations are not described as AI. Revenue and
MAU: **not found**.

### 4.5 The rest — verified thin, flagged honestly

- **Simkl** — free automatic TV+movie tracker, named across TV Time migration coverage.
  Funding/users/AI: **not verified**.
- **JustWatch** — streaming availability search and guide; business model believed to be
  affiliate plus data licensing. Site refuses automated fetches (403). Numbers: **not verified**.
- **Reelgood** — same category. 2025–26 status: **not verified**.
- **Likewise** — social recommendation app for movies, TV, books and podcasts, founded Oct 2017
  by ex-Microsoft people (Larry Cohen, Ian Morris, Michael Dix), **backed by Bill Gates through
  Gates Ventures**. Reached **1M users in July 2020**; MAU tripled Mar–Jul 2020. Its Wikipedia
  entry (last updated 16 Jun 2026) carries **no developments after 2020** and no mention of the
  AI assistant "Pix." Read that as a product that has not produced news in six years.
  <https://en.wikipedia.org/wiki/Likewise_(company)>
- **Goodreads** — Amazon-owned. 2024–26 AI features: **not verified**.
- **The StoryGraph** — books, positioned on better recommendations than Goodreads; site behind
  Cloudflare bot checks. Traction and funding: **not verified**.
- **Fable** — the closest structural analogue in existence: a social app for **books and TV
  together**, tagline *"the social app for bookworms and bingewatchers."* Moderator-run **clubs**
  are the core unit, not a bolt-on — spoiler-free discussion rooms, discussion feeds, Goodreads
  import, streaks and goals, personalized reader summaries and genre analytics, shareable
  monthly recaps. Club sizes range from hundreds to thousands. <https://fable.co/>
  Its Dec 2024 / Jan 2025 **AI-generated reader-summary controversy** (bigoted summary text,
  subsequent retreat) could not be re-verified in this pass — **not verified** — but note the
  visible site copy now advertises "personalized reader summaries" with no AI framing, which is
  consistent with a retreat. Funding and user numbers: **not found**.
- **Beli** — restaurant ranking app. Positioning read directly from <https://beliapp.com/>:
  *"Track and share your favorite restaurants with your friends"* — Track / Share / Discover,
  with "personalized recs and top lists." Its mechanic (forced pairwise comparison producing a
  personal ranked list, then friend overlap) is the most transferable social primitive in this
  whole survey. Funding rounds and user numbers: **not verified** (search budget exhausted).
- **Rex, Pally, Perfectly Imperfect / PI.FYI, Gossip** and the broader 2025–26 "taste graph"
  wave: **not verified**.
- **Plex Discover, Netflix social features, Apple TV app**: **not verified**.
- **Cinema Daddy** — resolved, negative. Public search surfaces only an Indian film-promotion
  social brand in Kochi. In this repo it refers to a prior project of Jake's (the TMDB client
  pattern in `src/lib/tmdb/`). **Not a competitor.**
- **YC company directory and Product Hunt sweep** for 2024–26 taste/media/social-AI startups:
  **not completed.** The YC directory is a client-rendered app that neither WebFetch nor the
  headless text dump could read, and the search budget was gone. This is the single largest
  remaining gap in the note and should be re-run.

### 4.6 The demand-side evidence

Gracenote/Nielsen **2025 State of Play**, published **5 Nov 2025**
(<https://www.nielsen.com/news-center/2025/new-gracenote-report-highlights-impact-of-ineffective-content-discovery-on-consumer-happiness-with-streaming/>):

- Consumers spend **14 minutes globally / 12 minutes in the US** searching for something to
  watch, up from 10.5 minutes in mid-2023. France: 26 minutes — the length of an episode.
- **19% abandon a viewing session** when the search fails; **29% among 18–24s**.
- **45% describe the streaming experience as "overwhelming."** 33% say fragmentation hurts their
  experience (40% among 25–34s).
- **49% are willing to cancel a service** because of difficulty finding what to watch.
- **66% want a single guide** across all services with availability.

The pain is real, measured, growing, and *worst among the youngest cohort*. What the data does
not say is that the pain is **social** — it measures individuals searching, not groups arguing.

---

## 5. The "taste layer" thesis: is a private taste log defensible, or a feature?

### 5.1 Every assistant is racing to own personal context, and they get it for free

**OpenAI**: Memory first tested **13 Feb 2024**; broad rollout to Plus **April 2024**;
**"reference chat history"** **10 Apr 2025** (excluded at launch in the UK/EU/EEA); memory
extended to personalize web search **18 Apr 2025**; lightweight memory for **free** users
**3 Jun 2025**; Gmail/Calendar/Contacts connectors **12 Aug 2025**; **ChatGPT Pulse** (proactive
overnight briefs built from chats and connected Gmail/Calendar) **25 Sep 2025**; a **year-end
review, explicitly Spotify-Wrapped-shaped, 22 Dec 2025**; and **"Dreaming: Better memory,"
4 Jun 2026**, replacing the saved-memory list with background synthesis. OpenAI's own published
benchmark across three memory generations: factual recall **41.5% (2024) → 67.9% (2025) → 82.8%**;
preference adherence 31.4% → 71.3%; time-sensitive updates 9.4% → 75.1%.
<https://openai.com/index/chatgpt-memory-dreaming/>

Altman has stated the ambition directly. On memory, **10 Apr 2025**: *"ai systems that get to know
you over your life"* (<https://x.com/sama/status/1910380643772665873>). At Sequoia AI Ascent,
reported **15 May 2025**: the goal is *"a trillion tokens of context that you put your whole life
into."*
<https://techcrunch.com/2025/05/15/sam-altmans-goal-for-chatgpt-to-remember-your-whole-life-is-both-exciting-and-disturbing/>

**Anthropic**: Projects **25 Jun 2024**; memory for Team/Enterprise **11 Sep 2025**
(project-scoped, editable); Pro and Max **23 Oct 2025**; all users including Free **2 Mar 2026**;
and **25 Aug 2026**, unified memory across chat and Cowork — **enabled by default on Free/Pro/Max**,
abandoning the strict opt-in stance that had been its 2025 differentiator.
<https://claude.com/blog/claudes-memory-works-everywhere-and-you-decide-whats-in-it>

**Google**: "Gemini with personalization" against **Search history** **13 Mar 2025**; personal
context **on by default 13 Aug 2025**; **Personal Intelligence** **14 Jan 2026** — one-tap
connection to **Gmail, Photos, YouTube and Search**; Gmail and Photos wired into Search's AI Mode
**22 Jan 2026**. <https://blog.google/innovation-and-ai/products/gemini-app/personal-intelligence/>

**Spotify AI DJ** (22 Feb 2023) is the cleanest example of the taste layer as a *platform
feature*: *"personalization is at the heart of what we do at Spotify."* Voice requests
13 May 2025, text requests 15 Oct 2025 in 60+ markets, four new languages 7 May 2026.
**And it is the one personalization feature of this cycle with disclosed, compounding,
nine-figure engagement**: in August 2023 eligible Premium users spent "nearly one-third of their
listening time with DJ"; engagement "nearly doubled" over the following year; and on the
**Q4 2025 earnings call (10 Feb 2026)** Spotify disclosed **~90 million subscribers have used AI
DJ, driving over 4 billion hours of time spent** (against 290M Premium subs / 751M MAU). By
7 May 2026 the figure was 94 million.
<https://newsroom.spotify.com/2023-08-08/ai-dj-expanded-new-markets-how-to-use-feature/>;
<https://newsroom.spotify.com/2026-02-10/spotify-q4-2025-earnings/>

Note what Spotify sells, though. Gustav Söderström's **10 Dec 2025** post launching Prompted
Playlist pitches prompting as **user control over the recommender**, not as the recommender
knowing you: *"Your ideas, your logic, and your creativity can actually power the Spotify
algorithm,"* and *"There's no longer a tradeoff between control and convenience."* The podcast
version (7 Apr 2026) attaches a **per-episode explanation of why it was included**.
<https://newsroom.spotify.com/2025-12-10/spotify-prompted-playlists-algorithm-gustav-soderstrom/>

TikTok did the same thing on **4 Jun 2025** with "Manage Topics" — users dial topic frequency in
the For You feed, but only to "influence how often they're recommended," never to remove. A
steering wheel, not a switch.

**Netflix**: AI-revamped search announced 18 Apr 2025; the **OpenAI-powered conversational search**
shipped as an **opt-in iOS beta on 7 May 2025** after early access in Australia and New Zealand;
on **17 Apr 2026** Netflix confirmed a broader AI recommendations push plus a vertical video feed,
with co-CEO Greg Peters saying there is *"tremendous room to make it better."*
<https://techcrunch.com/2026/04/17/netflix-plans-to-add-a-vertical-video-feed-use-ai-for-recommendations/>

**The structural point.** The entity that owns consumption owns taste for free. Spotify, Netflix,
YouTube and TikTok never have to ask. Headshot has to ask.

### 5.2 The historical record: taste data produces acquisition value, never a moat

This is the most important table in the note.

| Asset | What it had | What happened |
|---|---|---|
| **Last.fm** | Scrobbling — the richest listening dataset of the 2000s | CBS bought it in 2007 for **£140M**; founders gone by 2009; radio shut Apr 2014; spun back out independent **27 May 2026**. Survives as a niche log. |
| **Goodreads** | 150M+ members, the definitive book graph | Amazon acquired it **28 Mar 2013**. Thirteen years on it is criticised for "lack of development and maintenance" and a primitive recommender. StoryGraph launched 2019 as the reaction. |
| **Foursquare** | ~3M check-ins/day, the canonical place graph | Stripped check-ins out in v8.0 (**7 Aug 2014**); became a B2B location-data company; **City Guide app closed 15 Dec 2024**. The *data* survived as enterprise; the consumer taste product did not. |
| **Netflix ratings** | Cinematch plus the Netflix Prize corpus | The **$1M winning algorithm was never deployed** (Sept 2009 — not worth the engineering cost); the sequel was cancelled **12 Mar 2010** after a de-anonymisation suit; five-star ratings replaced by thumbs in 2017. |
| **Pandora** | Music Genome Project — 450 hand-coded attributes | 80M users at IPO (2011) → 70M MAU (2013) → **~46M (2023)**. Sold to SiriusXM **Feb 2019 for $3.5B in stock**. The most hand-built taste model in music lost to collaborative filtering plus distribution. |
| **Letterboxd** (live) | 30M+ film-taste profiles | 60% sold to Tiny at **~$50–60M (Sept 2023)**; LionTree hired to sell by **26 Apr 2026**; Netflix, Sony, Paramount Skydance circling at a reported **~$250M**. Semafor's characterisation is the tell: the site *"has not been optimized to show users content from people they don't follow."* |

**The pattern is unambiguous.** Taste data has reliably produced *acquisition* value and has never
once produced a durable independent consumer franchise. It is an asset that gets bought, not a
moat that compounds. And Letterboxd — the one asset currently appreciating — is appreciating as
**community and identity, not as a recommender**. That is the actual lesson for this space.

### 5.3 "Context is the moat" — the argument, and why it is currently losing

**For.** a16z (Olivia Moore, 9 Mar 2026): *"The more an LLM knows about you, the better results it
can provide."* Menlo Ventures (26 Jun 2025) names **persistent memory, workflow integrations and
proprietary user data** as the three defensibility factors. Shubham Saboo's "Context is the new
Moat" (Dec 2025) popularised the slogan.

**Against, and the against case is stronger because it is evidence rather than essay:**

1. **Menlo's own report undercuts it in the same document**: consumer switching costs are
   *"nearly zero,"* with no data-migration barriers; **91% of AI users rely on general assistants
   for nearly every task**; **81% of consumer AI spend ($10B of $12B) goes to those assistants.**
2. **Google shipped the migration tool.** On **26 Mar 2026** Google released tooling to import your
   chat history and memory **from ChatGPT and Claude into Gemini** — copy the memory prompts or
   upload the export zip.
   <https://techcrunch.com/2026/03/26/you-can-now-transfer-your-chats-and-personal-information-from-other-chatbots-directly-into-gemini/>
   **If context were a moat, the incumbent's context would not be one zip file away.**
3. **Monetisation failed at the point of transaction.** OpenAI launched Instant Checkout
   **29 Sep 2025** (Etsy, then Shopify, PayPal 28 Oct, Target 19 Nov). On **24 Mar 2026** TechCrunch
   reported OpenAI scaling it back: an October study found e-commerce sites *"were not making much
   money from ChatGPT users,"* and users *"weren't using the chatbot to actually help them make
   purchases."* OpenAI is repositioning ChatGPT as a *research* surface that routes to merchants.
   <https://techcrunch.com/2026/03/24/openais-plans-to-make-chatgpt-more-like-amazon-arent-going-so-well/>
   That is a dated, direct refutation of the strongest version of the taste-layer monetisation
   thesis: knowing the user did not convert into transaction control.
4. **Portable-personal-memory startups are a graveyard.** **Rewind AI → Limitless** (a16z-backed,
   $33M+ raised, pivoted to a $99 pendant Apr 2024) was **acquired by Meta on 5 Dec 2025**, price
   undisclosed, folded into Reality Labs; customers got one free year then sunset. **Humane** raised
   **$240M** and sold to **HP for $116M (Feb 2025)**, with devices bricked on 28 Feb 2025. The two
   best-funded consumer "own your personal memory" plays of the cycle ended inside ten months of
   each other, both absorbed.

Note also that personal data is **not on Anish Acharya's defensibility list** for AI apps
(multi-model orchestration, domain specialization, network effects, 8 Jan 2026), and the Stanford
CodeX ranking of vertical-AI moats (18 Jun 2026) puts workflows and UX first with the data-driven
"brain" fourth. Bryan Kim's June 2025 title is "In Consumer AI, **Momentum** Is the Moat."

### 5.4 What the VCs *have* asked for, which is almost exactly this

The most on-the-nose source in this entire note is **a16z Speedrun's "14 Big Ideas for 2026"**
(18 Dec 2025, <https://speedrun.substack.com/p/14-big-ideas-for-2026>). Idea #9, Lester Chen,
is titled **"Curation, not content, will be king"** and describes the Headshot premise nearly word
for word: *"An 'agent of my tastes' recording the things i consume and suggesting the most
relevant pieces of media worth spending my time on."*

Also on that list: #6, Josh Lu, **"The world will begin to optimize for ME"** — *"in 2026, I
believe this paradigm flips"* away from economies of scale; #14, Kenan Saleh, **"The coming
consumer AI renaissance"**; and #3, Fareed Mosavat, **"Multi-player AI will eat single-player AI."**

So a16z's consumer accelerator has publicly named *taste agents for media* and *multiplayer AI* as
2026 big ideas, and YC has named consumer AI including entertainment. **The thesis is validated at
the level of words. The absence of funded companies executing it is the thing that needs
explaining** — and the likeliest explanation is not that nobody thought of it.

### 5.5 The sharpest version of both sides

**The pro-moat case, at its best.** a16z's Big Ideas 2026 Part 1 (9 Dec 2025), Joshua Lu, "The
year of me": *"The biggest companies of the last century won by finding the average consumer"* —
the next century's win by finding the individual inside the average. Part 2 (10 Dec 2025),
**Bryan Kim, "Consumer AI shifts from productivity to connectivity"**: from "help me" to "see me,"
context windows that learn the full texture of your life, pitched explicitly as a **retention**
argument. And the version that actually matters for Headshot — **Alex Immerman, "Vertical AI goes
multiplayer,"** which locates the moat in **multi-party context**: the senior partner's markup
trains the system for the entire firm. Pete Flint (NFX, July 2025) makes the same move for
consumer, naming "personal utility networks" built on accumulated AI memory as a genuine network
effect. Ben Thompson (14 Apr 2025) conceded ChatGPT memory is *"the sort of product feature that
can build a moat."*
<https://a16z.com/newsletter/big-ideas-2026-part-1/>; <https://a16z.com/newsletter/big-ideas-2026-part-2/>;
<https://www.nfx.com/post/ai-defensibility>

Note the shape of the one credible version: **memory is defensible when it is multi-party.** That
is the strongest argument available for Headshot's multiplayer instinct, and it comes from a16z,
in December 2025, about vertical AI.

**The counter-case, at its best.** Benedict Evans, "How will OpenAI compete?" (**19 Feb 2026**) is
the sharpest named critic and addresses memory head-on: it is **"stickiness, not a network
effect."** His evidence is the part that should worry anyone here — **80% of ChatGPT users sent
fewer than 1,000 messages in all of 2025**; usage is "a mile wide but an inch deep." Menlo, from a
firm actively making the personalization bet (26 Jun 2025): **"switching costs are practically
zero; there's no data migration, no sunken cost."** a16z against itself — Casado and Bornstein's
"The New Business of AI" (16 Feb 2020) remains the best data-moat debunk, concluding AI "may
largely be a pass-through, from a defensibility standpoint," and a16z Enterprise (19 Dec 2025)
says moats come from vertical specificity and boring software, **not primarily from data**.
Structurally, the **EU Data Act** became applicable **12 Sep 2025** mandating effective switching
between data-processing providers, and **MCP** — donated to the Agentic AI Foundation under the
Linux Foundation in Dec 2025 — is an open standard for pulling a user's data into *any* model.
Portability is now legal, technical and competitive at once.

Even the pro-moat expert concedes the limit. Harrison Chase (Sequoia podcast, 11 Sep 2026) calls
memory "a real moat" because agents learning from their own traces compound — **and immediately
notes it works for specific workflows, not general-purpose apps.**

### 5.6 The personal-memory startup scoreboard, September 2026

| Company | Raised | Status |
|---|---|---|
| **Rewind → Limitless** | $33M+ (a16z, First Round, NEA) | **Acquired by Meta, 5 Dec 2025.** Hardware sales ended immediately; service pulled from the EU, UK and six other markets. |
| **Humane** | ~$230–240M | **Dead.** HP bought *assets only* for **$116M, 18 Feb 2025**; Pins bricked 28 Feb 2025. |
| **Human Native AI** | ~$3.6M | **Acquired by Cloudflare, Jan 2026.** Never raised a Series A. |
| **Personal.ai** | ~$16M | Alive but small; **pivoted from consumer to enterprise**. |
| **Mem (mem.ai)** | $23.5M, led by the OpenAI Startup Fund | Alive, **pivoted** — now "Mem Agent, the AI Chief of Staff." |
| **Mem0** | $24M (Oct 2025) | **Alive and strongest** — API calls 35M (Q1'25) → **186M (Q3'25)**. Infrastructure sold to developers. |
| **Plaud** | — | **The commercial outlier: >2M devices shipped, $100M+ software ARR (16 Jun 2026).** |
| **Granola** | $125M @ **$1.5B** (25 Mar 2026) | Alive, fastest riser — by moving **up-market into enterprise**, away from personal memory. |
| **Inrupt / Solid** (Berners-Lee) | ~$30M | Alive, not scaling. |

**Read the table by where the money is.** The survivors are **infrastructure sold to developers**
(Mem0, Supermemory), **hardware with a real unit economy** (Plaud), or **an enterprise pivot away
from personal memory** (Granola, Personal.ai, Mem). Every *consumer-owned personal memory* play is
dead, acquihired or not scaling — three acquihires in ten months.

### 5.7 The twenty-year record, extended

Beyond Last.fm, Goodreads, Foursquare, Netflix and Pandora:

- **Delicious** — 5.3M users, 180M bookmarked URLs (2008); *invented* consumer tagging. Yahoo
  bought it 9 Dec 2005 (~$15–30M); then AVOS, Science Inc., Delicious Media, and finally Pinboard
  in **June 2017**, read-only within weeks. Four owners, zero durable value.
- **StumbleUpon** — 25M registered (Apr 2012); in 2009 drove more US referral traffic than
  Facebook, YouTube, Twitter or Reddit. eBay bought it **30 May 2007 for $75M+**; the founders
  **bought it back in April 2009 for $29M** (eBay cited "few long-term, strategic synergies");
  shut down **30 Jun 2018**. The best per-user taste profile on the web was worth less than eBay
  paid for it.
- **Digg** — the v4 redesign (Aug 2010) triggered a mass exodus; Reddit grew 230% that year;
  **Betaworks bought the brand for $500,000 in 2012**.
- Precision on Netflix: five stars were replaced by thumbs on **16 Mar 2017**, because the binary
  signal drew **200% more ratings** in testing. That is the whole argument in one number.

**Five findings from the record, which is the real answer to the brief:**
1. **The data outlived the product every time and never kept the users.** People left for better
   *feeds*, not better *profiles*.
2. **Better preference data was repeatedly abandoned for cruder data with higher collection
   volume.** Fidelity of signal mattered less than rate of accrual — which structurally favours
   whoever already owns the attention.
3. **The only durable escape was selling the data to businesses.** Foursquare is the clean case:
   consumer app killed Dec 2024, Places API still inside Uber and X. That is a different company.
4. **Prices were small and mostly declining.** Last.fm £140M (2007) and Pandora $3.5B (2019,
   largely an ad/licensing price) are the ceilings; StumbleUpon $75M then $29M; Delicious ~$20M;
   Digg $500k. The 2025–26 personal-memory exits were acquihire terms.
5. **Goodreads is the one real counterexample, and it argues for distribution, not data** —
   150M+ members held through thirteen years of deliberate neglect, defended by the social graph
   plus Amazon, not by the ratings.

**The honest conclusion on "context is the moat."** Only the narrow form survives this record.
Personal memory is defensible when it is **(a) generated as a byproduct of work the user would
otherwise redo elsewhere, and (b) wired into a multi-party loop so it compounds beyond one
person.** Solitary personal preference data — the Last.fm / Netflix / Pandora / StumbleUpon shape,
which is exactly the shape of a single-player film diary — has a clean twenty-year record of being
*stickiness*, and stickiness gets absorbed.

**Read of item 5.** A private cross-service taste log is a genuinely scarce asset and a genuinely
weak moat. It is scarce because the platforms are siloed and the user is the only join key —
Netflix knows Netflix, Max knows Max, and Gracenote found **66% of viewers want a single guide
across all services**. It is weak because taste data has never once won a consumer category,
because the log is a few thousand rows, because a competitor rebuilds it from a Letterboxd import
in thirty seconds, and because the assistants accumulate context as a byproduct of use while
Headshot has to ask. **If the moat argument for this company is "we have your taste data," the
company has no moat.** The defensible version has to be a *social graph of taste* — data that
exists only because several specific people are all on the same product. Which is exactly the
multiplayer claim, and puts the entire weight of the company on section 6.

---

## 6. Multiplayer with friends: does small-group consumer AI actually retain?

### 6.1 OpenAI shipped group chats. Then said nothing for ten months.

Confirmed, with dates.

- **14 Nov 2025 — pilot.** Japan, New Zealand, South Korea, Taiwan. Free, Plus and Team, mobile
  and web, **1–20 people**, running GPT-5.1 Auto. You tag ChatGPT to summon it; emoji reactions;
  rate limits apply to AI responses only. **Personal memory and private chats stay private** —
  group content is shared only among participants. OpenAI called it a "small first step" toward a
  "shared experience."
  <https://techcrunch.com/2025/11/14/chatgpt-launches-pilot-group-chats-across-japan-new-zealand-south-korea-and-taiwan/>
- **20 Nov 2025 — global rollout**, six days later, across Free, Go, Plus and Pro; up to 20
  participants; adding someone to an existing chat forks a new conversation. OpenAI's framing:
  ChatGPT as *"a collaborative environment, not just a single-player experience,"* and over time
  *"playing a more active role in real group conversations."*
  <https://techcrunch.com/2025/11/20/chatgpt-launches-group-chats-globally/>

**And then nothing.** There is no 2026 follow-up article on group-chat expansion, and **OpenAI has
published no adoption or engagement number in the ten months since**. a16z's "State of Consumer AI
2025" (18 Dec 2025) lists **Group Chats alongside Pulse, Tasks and Study Mode as features that
have "not truly broken through"** — from the firm most bullish on OpenAI, in the same report where
it documents 900M WAU. a16z's Top 100 (9 Mar 2026) surveys the entire consumer AI market and
states flatly: **"no one has yet cracked AI x social."**

a16z's own explanation for why those features failed is the single most useful sentence here for
anyone building in this space: it is hard to deliver a first-class experience **inside the existing
ChatGPT interface**. They name Replit, Suno, Character.AI and ElevenLabs as the counter-examples —
winners with "opinionated and focused interfaces."

### 6.2 Everyone shipped AI-in-the-group-chat. Nobody published a number.

- **Character.AI** shipped group chats with multiple humans and multiple AIs on **11 Oct 2023** —
  two years before OpenAI. It never became what Character.AI is known for; its stickiness is 1:1.
  Then on **29 Oct 2025** it announced it would remove open-ended chat for under-18s, phased to
  zero by **25 Nov 2025**, after lawsuits over teen suicides and an FTC 6(b) inquiry. CEO
  Karandeep Anand acknowledged earlier safety measures had already caused significant teen churn.
  Web traffic slid ~15% across H1 2026 (194.4M visits Jan → 165.8M Jul).
- **Snapchat My AI** launched **27 Feb 2023** and opened to all users and to group chats in April
  2023. On **24 Apr 2023** it drew a spike of 1-star App Store reviews demanding its removal. Snap
  has never published sustained engagement figures for it. The first mass-deployed AI-in-group-chat
  was met with a review-bombing campaign.
- **Meta AI** in WhatsApp/Messenger group chats from **27 Feb 2023**; image generation inside group
  chats **6 Dec 2023**; AI-drafted replies in WhatsApp **26 Mar 2026**. Telling move: Meta bought
  the *memory* company (Limitless, 5 Dec 2025) rather than building a group-AI product.
- **Discord Clyde** shipped **9 Mar 2023** and was jailbroken within six weeks (**20 Apr 2023**).
  Its late-2023 shutdown is widely reported but the **exact date could not be verified** here.

**Contrast with enterprise, where multiplayer AI has hard numbers**: Dust cites **zero churn and
70% weekly active usage** (Sequoia, May 2026), and Jared Friedman says QM is *"the first version of
multi-player AI I've really seen work."* **In enterprise, multiplayer AI is working. In consumer,
after three years and four platform attempts, it is not.**

### 6.3 The one live consumer signal

**Shapes** (29 Apr 2026): a Discord-like app where custom AI characters sit in human group chats as
labelled participants. Founded 2022; **400,000+ MAU, up 6× since the start of 2026**; thousands of
users spending **2–4 hours daily**; **3 million** user-built characters; **$8M seed led by
Lightspeed**. CEO Anushk Mittal: *"Our lives run on group chats"* — so it is natural to bring AI
into them. Its positioning is AI as **social facilitator, not companion**.

Scale check: 400K MAU against ChatGPT's 900M weekly. The category is real and tiny, and it is
fandom-shaped, not utility-shaped. It is also the only product in this survey whose engagement
numbers would survive contact with Bryan Kim's benchmark grid.

### 6.4 The platform-owned group-watch graveyard

This is the strongest single finding in the whole note, because these features had **free
distribution to hundreds of millions of users, zero CAC and no monetisation pressure** — and every
one died, with the same one-word reason.

| Feature | Launched | Killed | Stated reason |
|---|---|---|---|
| Netflix Play Something / Surprise Me | **28 Apr 2021** global | **Jan 2023** | "relatively low use" |
| Disney+ GroupWatch | Sept 2020 | **18 Sep 2023** | quiet removal during cost-cutting |
| Twitch × Prime Video Watch Parties | beta Oct 2019, US 2020 | **2 Apr 2024** | usage "has declined over the years" |
| Prime Video in-app Watch Party | 2020 | removed by **~8 Jul 2024** | never announced |
| HBO co-viewing (via Scener) | 14 May 2020 | folded away | — |
| Houseparty (Epic, ~$35M) | 2016/2019 | announced **9 Sep 2021** | absorbed into Epic |

Disney's help-centre wording: *"As of September 18th, 2023, the GroupWatch feature will no longer
be available on Disney+."* Netflix's Help Center confirms Play Something *"was discontinued in
January 2023."*
<https://www.engadget.com/twitch-is-ending-its-pandemic-era-prime-video-watch-parties-110004438.html>;
<https://www.fastcompany.com/90851139/netflix-killed-its-surprise-me-button-heres-why-the-shuffle-play-feature-never-made-much-sense>

**That is evidence the "help us decide together" job is low-frequency and low-repeat, not that
nobody has executed it well.** It is the difference between a hard problem and a small one.

**Swipe-to-match movie pickers barely exist as a category.** The only named products with any
coverage are Swipe With Friends (Jan 2021) and Matched (Jul 2024) — each covered once, as a
novelty, with no funding and no follow-up. **No swipe-to-pick-a-movie app has generated a second
news cycle.** Reelgood and JustWatch persist as *solo* aggregators.

**What Netflix built instead is the tell.** "Moments" (save and share a scene) shipped Dec 2024
and was upgraded 3 Sep 2025; the mobile redesign with a vertical Clips feed landed **30 Apr 2026**
in nine countries and went global 25 Aug 2026. Netflix's answer to social was **share a clip into
an existing messaging graph**, not build a group surface. Discord reached the same conclusion from
the other direction: Watch Together shipped **17 Oct 2022** as an Activity *inside voice channels
that already existed*.

Also worth noting against the SEO noise: **Scener is not shut down** — scener.com was live at
fetch time with a 2026 copyright and active login. Alive but press-dormant since Oct 2020.

### 6.5 Small-group social: the mortality table

- **Path** — launched 14 Nov 2010 with a deliberate **50-friend cap**; sold to Daum Kakao
  28 May 2015; shut **17 Sep 2018**.
- **Google Shoelace** — 11 Jul 2019 → **29 Apr 2020**. Under ten months.
- **Cocoon** — $3M seed (Lerer Hippeau, YC, Susa, Norwest, SV Angel), launched Nov 2019 explicitly
  chasing Path. Team **joined Substack Aug 2021** — the app was *not* part of it. Two years from
  launch to acquihire.
- **Clubhouse** — 600K registered Dec 2020 → 8.1M downloads mid-Feb 2021 → **$4B valuation
  Apr 2021**; the user base declined 21% within three weeks of peak; **Apr 2023 staff cut by more
  than half** and pivot away from live rooms.
- **IRL** — shut **26 Jun 2023** after admitting **95% of its users were fake**; founder charged by
  the SEC over a **$170M** scheme; $1.2B peak valuation.
- **BeReal** — #1 free app 25 Jul 2022; peak **~10M DAU / 21.6M MAU late Aug 2022** (47.8M MAU by
  Feb 2023) → ~6M DAU by late spring 2023; sold to **Voodoo for €500M, Jun 2024**, part
  performance-based. Now an ad business. **Daily time on app: 9.2 minutes (Jan 2026).**
- **Gas** — 3.1M downloads Nov 2022 → **2,900 in Sept 2023**. Discord announced the kill
  **18 Oct 2023**; service ended 7 Nov 2023. Citron told staff internally it was an
  engineering-talent acquisition.
- **Lapse** — chart-topping Sept 2023 on a forced friend-invite mechanic; **$30M Series A
  27 Feb 2024**; then essentially nothing.
- **Geneva → Bumble** — announced 20 May 2024, closed 1 Jul 2024; by 2026 the brand is gone and the
  features live inside Bumble BFF.
- **Nikita Bier** — tbh → Facebook (2017, dead 2018); Gas → Discord (2023, dead 2023). The most
  decorated builder in teen consumer social has twice hit #1 and twice sold into a shutdown within
  about twelve months of peak.

**Time from peak to death or fire-sale:** Shoelace ~10 months, Gas ~12, Houseparty ~18, BeReal ~20,
Clubhouse ~24.

### 6.6 The two survivors, and why — this is the most useful page in the note

- **Locket Widget** — viral Jan 2022, $12.5M raised Aug 2022, and then it *compounded*:
  **91M+ lifetime installs, 100K+ paying subscribers, 25%+ of actives posting weekly**, profitable
  since 2024, **15 people**.
  <https://techcrunch.com/2025/11/03/lockets-social-app-is-picking-up-steam-with-gen-alpha/>
- **Airbuds** — the direct analogue, and it works. A music-taste social app: **5M MAU / 1.5M DAU, a
  ~30% DAU/MAU ratio**, $10M raised (announced 17 Sep 2025). Founder Gilles Poupardin on why:
  *"It's effortless. You just connect your Spotify, and it shares in real time."* He also concedes
  only *"around 30% of users engage with features beyond seeing what friends stream."*
  <https://techcrunch.com/2025/09/17/airbuds-is-the-music-social-network-apple-and-spotify-wish-they-had-built/>
- **Teleparty** — 20M+ claimed users, still shipping in 2026. A free browser extension on someone
  else's content with someone else's voice call: near-zero marginal cost, and no graph of its own
  to retain.

**The rule these three and Partiful share, and that every corpse above violates:** the survivors
are **utilities with a graph attached, not graphs looking for a use.** Each does something for
*one* person the instant they open it, and gets social value as a byproduct. This is exactly
D'Arcy Coolican's a16z thesis (7 Dec 2020, "Community Takes All: The Power of Social+"): the best
version of every consumer product is the intrinsically social one — and every example he gives is
a **utility or content product that grew a graph**, never a graph-first app that later found a use.
<https://a16z.com/community-takes-all-the-power-of-social/>

**And the clock-speed problem, stated numerically.** A "what should we watch tonight" tool fires
only when a group actually convenes — one to three times a week at absolute best, and only when
co-located or co-scheduled. Against Bryan Kim's grid, where "Good" is 40% DAU/MAU and "OK" D30 is
20%, **a weekly-occasion product structurally cannot clear the bar**, and its D1/D7 is measured
against an occasion that has not yet recurred. That is the category's clock speed, not a growth
problem to be fixed with better onboarding.

**Read of item 6.** Group AI is validated as a direction by the biggest names in the industry and
falsified as a consumer product by every attempt so far, including OpenAI's own and every
streaming platform's. The only consumer multiplayer mechanics with real proof in media are
**asymmetric follow plus a personal log** (Letterboxd — 10M to 30M+ in under three years with no
feed, no recommendations, no AI) and **effortless passive sharing** (Airbuds, 30% DAU/MAU on
auto-connected Spotify data). Both are utilities first. Neither is a group decision tool. Anyone
betting on "friends + AI + media" is betting that two halves that individually work combine into
something that retains, and the published evidence says the *group decision* half is the weak one.

---

## Synthesis

**1. The category is real, but the name is borrowed and it points at the wrong industry.**
"Multiplayer harness" is a live term of art as of mid-2026 — and it means *a team's agents doing
work*. YC open-sourced QM on 31 July 2026 and called it exactly that; Dust raised $40M on
"multiplayer AI" in May; Sequoia's Buhler framed the pitch as *"Most enterprise AI today is
single-player"*; Slack, Block and Anthropic all shipped into the same phrase within six weeks.
If Jake says "multiplayer harness" to a YC partner, they will hear QM for companies. The consumer
version of the sentence has no currency: a16z's consumer team does not use "multiplayer" as a
thesis word at all, and their flagship 2026 consumer bet, Town ($55M, June 2026), is explicitly
single-player. Keep the idea, drop the phrase. The phrase that *is* validated, almost verbatim, is
a16z Speedrun's idea #9 from 18 Dec 2025: *"an 'agent of my tastes' recording the things i
consume."* That is Headshot's sentence, written by a16z, nine months ago.

**2. "Multiplayer media with friends" makes sense as a category the way "co-watching" made sense
as a category — which is to say the demand is real and the product shape is a graveyard.** The
demand evidence is solid and dated: Gracenote's November 2025 State of Play has viewers spending
12–14 minutes hunting for something to watch (up from 10.5 in 2023), 45% calling streaming
"overwhelming," 19% abandoning the session outright (29% among 18–24s), 49% willing to cancel a
service over it, and 66% wanting one guide across services. But every product built directly at
that pain has died: Netflix's Play Something (Apr 2021 → Jan 2023, "relatively low use"), Disney+
GroupWatch (Sept 2020 → 18 Sep 2023), Twitch × Prime Watch Parties (→ 2 Apr 2024, usage "declined
over the years"), Amazon's own in-app Watch Party, Houseparty, Rabbit, Cabana. These had free
distribution to hundreds of millions of people and zero customer-acquisition cost. **They did not
fail on execution. They failed because deciding what to watch together is a 90-second problem that
recurs once or twice a week, and that clock speed cannot carry an app.**

**3. Who is already there: nobody is doing this, and that is more worrying than reassuring.**
Letterboxd has 30M+ members, movies only, **no recommendation engine and no AI feature of any
kind**, and is being sold — LionTree ran a process from April 2026, with Netflix, Sony, Paramount
Skydance, RedBird, TPG and Alexis Ohanian reported as bidders at a floated ~$250M. Trakt has 17M
accounts and does scrobbling. Serializd is a free one-person Letterboxd-for-TV. Fable is the
closest structural analogue — books *and* TV, with moderator-run clubs as the core unit — and it
got burned by AI-generated reader summaries in Dec 2024. Likewise, the Gates-backed version of
exactly this idea, has produced no news since 2020. **The white space is genuine.** But an empty
market that several well-capitalised teams have walked through is usually empty for a reason, and
in this case the reason is legible in the retention data.

**4. The one unambiguous opening, and it has a clock on it.** TV Time — 26.4M lifetime installs,
marketed as "more than 25 million users" — **shut down permanently on 15 July 2026 and deleted
everyone's data**, because Whip Media's new owner pivoted to enterprise AI. Simultaneously,
Letterboxd cannot log a returning TV series, three years after announcing it would, and publicly
reconfirmed after the shutdown that it is "still working on" TV. So roughly 25 million people who
demonstrated the exact behaviour Headshot depends on — voluntarily logging television, every week,
for years — were made homeless two months ago, and the category leader cannot take them. The
migration guides sent them to Trakt, Serializd and Simkl, none of which has an AI story. **This is
the wedge, it is dated, and it will close the moment Letterboxd ships TV or a buyer makes them.**

**5. What makes it a company rather than a side project: the wedge is TV, the loop is the diary,
and the data advantage is cross-service — in that order.** The strongest empirical fact in this
whole note is that **Letterboxd went from 10M to 30M+ members in under three years with no
algorithmic feed, no recommendations and no AI.** The retention came from the diary and the
follow graph, not from discovery. The second strongest is Airbuds: 5M MAU, 1.5M DAU, a **~30%
DAU/MAU ratio** on music-taste social, and the founder's explanation is one word — *"It's
effortless. You just connect your Spotify."* Every survivor in this space (Locket, Airbuds,
Teleparty, Partiful, Letterboxd) is a **utility with a graph attached**; every corpse (Path,
Shoelace, Cocoon, Gas, Geneva, BeReal) is a **graph looking for a use**. Headshot is currently on
the right side of that line — it is a log first — and the single largest product risk is drifting
to the wrong side in pursuit of "multiplayer."

**6. The data advantage is real but narrower than it sounds.** Nobody owns cross-service viewing:
Netflix knows Netflix, Max knows Max, and the user is the only join key. That is why 66% of
viewers want one guide. But a private taste log is a **scarce asset and a weak moat**, and the
historical record is unanimous: Last.fm had the richest listening dataset of the 2000s and sold for
£140M into irrelevance; Pandora hand-coded 450 musical attributes and lost to collaborative
filtering plus distribution, selling for $3.5B in stock; Goodreads has 150M members and Amazon has
done nothing with it for thirteen years; Foursquare stripped out check-ins and became a B2B data
vendor; Netflix ran a $1M prize on the best ratings corpus in history, **never deployed the winning
algorithm**, and killed star ratings in 2017 because, per Todd Yellin, *"the implicit signal of
your behavior is more important"* — the binary signal drew 200% more ratings. Add StumbleUpon
(25M users, more US referral traffic than Facebook in 2009, sold for $75M and bought back for
$29M), Delicious (invented consumer tagging, four owners, dead) and Digg (brand sold for
$500,000). **Taste data reliably produces acquisition value and never a durable franchise.**
Benedict Evans has the right word for it (19 Feb 2026): memory is *"stickiness, not a network
effect"* — and he notes 80% of ChatGPT users sent fewer than 1,000 messages in all of 2025. Menlo,
from a firm making the personalization bet, measured consumer switching costs as *"practically
zero."* Google shipped a one-click import of ChatGPT and Claude memory into Gemini on 26 March
2026; the EU Data Act mandated switching from 12 Sep 2025; MCP went to the Linux Foundation in
Dec 2025. **The only version of the moat argument that survives the record is the multi-party
one** — a16z's own Alex Immerman, Dec 2025: context is defensible when one person's input trains
the system for everyone else in their group. That, and only that, is why multiplayer is worth
pursuing here.

**7. The monetisation picture is the hardest thing in this note to argue around.** RevenueCat's
March 2026 dataset — 115,000+ apps, $16B+ tracked revenue — shows AI subscription apps retaining
**21.1% at twelve months against 30.7% for non-AI**, i.e. AI subscribers convert better and cancel
roughly 30% faster. Menlo measured a **$12B consumer AI market against a theoretical $432B**, a gap
explained by a **~3% free-to-paid conversion rate**, with **81% of spend going to general
assistants and ~70% to OpenAI alone**. The best consumer AI product on earth, ChatGPT, sits at 36%
DAU/MAU and ~7 minutes a day, which is between "OK" and "Good" on a16z's own social-app grid and
about 13× worse than social incumbents on time. Letterboxd, at 30M members and fifteen years old,
is called *"significantly undermonetized"* by the bankers selling it and runs on display ads and a
$19/year Pro tier. **Nothing in the evidence supports a large subscription business here.** The
honest ceiling on the obvious version of this product is a very good $250M outcome, which is what
Letterboxd is being priced at.

**8. Bet one: ship TV logging and go take the TV Time refugees, now, as the entire Q4 plan.**
Twenty-five million people with a deleted seven-year watch history, no home, and a demonstrated
weekly logging habit is the highest-quality cold audience available in consumer right now, and
Headshot's graph is already built on IMDb/TMDB data that covers series natively. Serializd is free
and has no AI; Trakt is a scrobbler for power users. The pitch — "your TV diary, and it can talk"
— needs no explanation to someone who just lost theirs. The reason this is bet one and not bet
three is that the window closes when Letterboxd ships TV, and Letterboxd is currently distracted by
being sold.

**9. Bet two: make logging effortless before making anything social.** Airbuds' ~30% DAU/MAU comes
from a single OAuth connection and passive real-time sharing; Letterboxd's 30M came from a diary
people keep; every manual-entry small-group app in the mortality table died when the novelty of
entering data wore off. Headshot already has the Letterboxd crawl and the catch-up deck in the v5
spec — those are the right instincts. Push further: Trakt import, TV Time export ingestion (the
GDPR exports exist on people's hard drives right now), Netflix and Prime viewing-history CSVs, and
a genuine scrobble path. **Effort per logged item is the single variable this product lives or dies
on**, and it matters more than any model, tool or prompt in the agent.

**10. Bet three: the multiplayer unit should be asymmetric and always-on — "whose taste do I
trust" — never a synchronous group-decision session.** Every synchronous co-watch and
group-decision product in this note died of low usage, including four built by platforms that could
distribute them for free. What has never been properly built is the persistent artifact: **taste
compatibility with specific named friends**, computed continuously, answerable at any moment
("Sam and I agree on 78% of things; here are four Sam loved that you haven't seen"). The evidence
that this is the live demand is that the third-party Letterboxd recommender ecosystem — which
exists only because Letterboxd ships no recommendations at all — sells precisely *"film
compatibility with friends."* This is asymmetric like Letterboxd's follow graph, it produces value
with one user and a friend's public profile rather than requiring a group to assemble, and it is a
reason to open the app on a Tuesday rather than only at 9pm on Friday.

**11. The honest risk list, in order of how likely it is to kill this.** (i) **Clock speed** — the
job to be done recurs weekly at best, and a weekly product structurally cannot clear a 40% DAU/MAU
bar or a 20% D30; the diary is the only thing that might, and the diary is Letterboxd's. (ii)
**Letterboxd ships TV**, or a streamer buys them and funds it — the wedge closes and Headshot is
competing with a 30M-member brand on its own turf. (iii) **No moat** — the taste log is a few
thousand rows, rebuildable from a Letterboxd import in thirty seconds, and personal data is not on
any serious 2026 defensibility list (Acharya's is orchestration, specialization, network effects;
Stanford CodeX ranks the data "brain" fourth behind workflow and UX). (iv) **Monetisation** — ~3%
of consumers pay for AI, AI subs churn 30% faster than non-AI, and inference is real COGS on every
answer, so the most engaged users are the least profitable. (v) **Outcome size** — the category's
best comparable is a ~$250M sale of a 30M-member fifteen-year-old brand; that is a great life and a
mediocre venture return, and Jake should decide which he is optimising for before raising. (vi)
**The consumer-AI base rate** — Sora had the best distribution in history, sub-8% D30, and was shut
down in March 2026; a16z's own verdict in March 2026 is that *"no one has yet cracked AI x
social."* (vii) **Positioning** — pitching "multiplayer harness" into a market where that phrase
means enterprise agent infrastructure will actively cost credibility.

**12. The bottom line.** "A multiplayer harness for media with your friends" is two claims wearing
one coat. The first — *a cross-service log of everything you watch, that you can talk to* — is a
real product with a real, dated, closing window (25M orphaned TV loggers; a leader that cannot log
TV and is up for sale), and the survivors' pattern says build it as a **utility that earns a graph**.
The second — *multiplayer as the organising idea* — is currently contradicted by every consumer
attempt on record, including OpenAI's own group chats, which shipped globally in six days in
November 2025 and have not been mentioned by OpenAI since. **The company is in the first claim. The
second is a feature of it, and should be sequenced as one.** "Eventually more than movies and TV"
is a Series B sentence, not a seed sentence; the 2026 evidence says pick one vertical where the
data is genuinely siloed and win it completely, because the only thing that has ever survived
contact with the assistants is an opinionated product for a specific community.

---

## Gaps and what to re-run

Stated so nothing here reads as more complete than it is.

- **The YC company directory and Product Hunt sweep for 2024–26 taste/media/social-AI startups was
  not completed.** The directory is client-rendered and defeated both WebFetch and the headless
  text dump, and the session's web-search budget (200 calls) was exhausted. **This is the largest
  remaining gap** — it is the check on "is a YC company already building this." Re-run with
  `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` raised.
- Beli's funding and traction, and its pairwise-comparison ranking mechanic, which is the most
  transferable social primitive in this survey. Not verified.
- The Fable AI-summaries controversy (Dec 2024 / Jan 2025) and Fable's funding and user numbers.
- Serializd and Trakt growth *after* the TV Time shutdown — the actual migration numbers. Nobody
  published them; they may be obtainable from app-store rank data.
- JustWatch, Reelgood, Simkl, StoryGraph: all behind bot protection, all unverified.
- Cocoon's shutdown date; Discord Clyde's shutdown date; Gemini in Google Messages group chats.
- Several tweet-sourced quotes (Garry Tan's "Thin Harness, Fat Skills", Jared Friedman on QM,
  the YC QM announcement) came through search indexes rather than x.com, which returns 402.
  **Verify verbatim before quoting any of them publicly.**
- The Manus/Meta (~$2B, Dec 2025), OpenClaw/OpenAI (Feb 2026) and Codex 2M WAU figures come from
  a16z's 6th-edition summary rather than primary reporting.
