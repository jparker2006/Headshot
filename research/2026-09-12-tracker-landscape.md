# Competitive research: media-logging / watch-tracking / discovery products (2025–2026)

Research date: 11 September 2026. Web-search budget was exhausted mid-research; the last ~10 findings came from direct page fetches. Gaps are flagged explicitly as "not public."

---

## HEADLINE FINDING FIRST

**TV Time — the single biggest consumer watch-tracking app, ~26M installs — shut down on July 15, 2026.** Its parent Whip Media was bought by a distressed-debt lender in Feb 2025 and pivoted to enterprise AI. That is roughly 25M orphaned TV loggers, and the land-grab for them has already started (JustWatch shipped a migration importer within days; Trakt, Simkl, Serializd, Moviebase are the named alternatives). This is the most important market fact in this whole report for a social movie/TV taste app.

---

## 1. Serializd

**What it is.** A Letterboxd-for-TV: a community-first logging platform where you log every series/season/episode, rate at episode, season and series granularity, write reviews, and follow other users. Web + iOS + Android with feature parity; catalogue data comes from TMDB. Launched publicly around 2023, developed by Serializd LLC and, by all appearances, a very small (near-solo) team. It is the app the "TV needs a Letterboxd" crowd actually converged on.
- https://www.serializd.com/about
- https://apps.apple.com/us/app/serializd/id1581244120
- https://www.producthunt.com/products/serializd
- https://www.resetera.com/threads/the-tv-logging-app-service-letterboxd-you%E2%80%99ve-been-waiting-for-is-finally-here.548255/

**Ownership / funding.** No disclosed funding. No VC round found in any source. Independent, developer-owned (Serializd LLC). **Not public / appears to be bootstrapped.**

**Traction.** No official user number published. Data points:
- App Store: 4.5★ from ~1.2K ratings (US), iOS 15.1+, 200.1 MB, latest version 1.986 shipped Aug 28 (2026) — https://apps.apple.com/us/app/serializd/id1581244120
- Product Hunt self-reported "10,000+ daily active users" (undated, at listing time) — https://www.producthunt.com/products/serializd
- Similarweb (data as of Sept 9, 2026, Google Play US): **#161 in Social** in the US, #7,175 overall US. Strong non-US skew — Spain #25 Social, Mexico #33 Social, Brazil #36 Social. — https://www.similarweb.com/app/google/com.serializdmobile/
- Free; no paid tier surfaced on the App Store listing.

**AI features.** None found. The Aug 2026 release notes are Emmy voting, blog posts, UI work — no AI.

**MULTIPLAYER?** **Semi-multiplayer — a follow graph, but weak.** It has: follow users, see their activity, public reviews on episodes/seasons/series, show recommendations to other users, public profiles with favourite shows, and blocking. What it lacks — and users complain about this explicitly in App Store reviews — is a real **social feed**; reviewers say "the follow system lacks a social feed comparable to Goodreads." There is no group decision-making, no shared/collaborative lists, no "what should we watch tonight" layer. It is a **broadcast** social model (I post, you read), not a **coordination** one. Also noted in reviews: constant crashing, slow page loads, buggy episode-count stats, inaccurate year-end reviews.

---

## 2. TV Time (Whip Media) — **DEAD as of July 15, 2026**

**What it is / was.** Launched 2011 (originally as part of the Hulu-adjacent tracker lineage), TV Time was the largest consumer TV-tracking app in the world: episode check-ins, watch history, watchlists, ratings, follow notifications, and community comments/discussion threads attached to individual episodes. Whip Media used the resulting behavioural panel as the raw material for a B2B data business (sentiment analysis, ratings prediction, content valuation) sold to studios and streamers.
- https://en.wikipedia.org/wiki/TV_Time
- https://en.wikipedia.org/wiki/Whip_Media

**Ownership / funding.**
- Whip Media Group founded 2019 by Richard Rosenblatt (Santa Monica, CA), rolling up **TV Time (acquired late 2016)**, **TheTVDB**, and **Mediamorph (acquired Oct 2019)**.
- Raised **$65M** in venture capital, plus a further **$50M in January 2020** from **Eminence Capital** and **Raine Ventures**. Headcount went 35 → 155 between July 2018 and Jan 2020.
- CEOs: Rosenblatt (to June 2023) → Carol Hanley (June 2023–Feb 2025) → **Welby Chen (Feb 2025–)**.
- **Acquired by Blue Torch Capital on February 19, 2025** — Blue Torch is a direct lender to "companies in transition," i.e. this reads as a distressed/debt-holder takeover, not a growth exit.
- https://en.wikipedia.org/wiki/Whip_Media

**Traction.**
- **20 million registered users** announced December 2021 — https://whipmedia.com/news/tv-time-hits-new-milestone-with-20-million-registered-users/
- At shutdown: **26.4 million lifetime installs**, Whip Media marketing claimed **"more than 25 million users."** Still doing ~**29,000 new downloads in the trailing 30 days** at the time of the shutdown announcement.
- Top-5 most-followed shows (2021): Stranger Things, Game of Thrones, The Walking Dead, 13 Reasons Why, Money Heist.
- https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/

**Shutdown.** Announced ~July 2, 2026; **service ended July 15, 2026**, app pulled from both stores, website offline, all user data permanently deleted. Company statement: *"While we loved supporting TV Time, it was no longer sustainable to continue operating the service as a free app, and there was not enough demand for a paid app."* Whip Media said personal data would be deleted and TV Time data would not be used in commercial services going forward. Export was via a GDPR self-service tool (gdpr.tvtime.com).
- https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/
- https://moviebase.app/resources/tv-time-shutting-down

**AI features.** Not in the consumer app. The *reason* for the shutdown is AI: Whip Media is now prioritising **Helix**, an AI-powered automation and workflow-management tool for streaming analytics and supply-chain orchestration. The consumer app was killed to fund an enterprise AI pivot.

**MULTIPLAYER?** **Yes, it was — that was its moat.** Episode-level community comments and discussion threads, follow/notification graph, a genuinely large and loyal community ("one of the internet's largest TV fan communities" per TechCrunch). And it is now gone. **The single clearest opportunity in this landscape: ~25M people who demonstrated they will use a social TV log just lost their home in July 2026.**

---

## 3. Trakt (trakt.tv)

**What it is.** The developer-facing, integration-first tracking backbone for film and TV: scrobbles automatically from Plex, Kodi, Emby, Infuse and dozens of third-party clients via a well-documented public API, and maintains watch history, collections, watchlists, progress, and lists. It is less a destination app than an infrastructure layer that other apps sync to — which is both its strength (ubiquity) and its weakness (no owned surface, no network effect).
- https://trakt.tv/
- https://docs.trakt.tv/docs/vip-methods

**Ownership / funding.** Independent, small team, no disclosed venture funding found. Trakt leadership has stated publicly that **the business model relies exclusively on VIP subscription revenue** — https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/

**VIP subscription — this is the interesting part, and it has been turbulent.**
- **February 7, 2025:** Trakt imposed hard free-tier limits and doubled VIP. Free tier capped at **2 personal lists (100 items each), watchlists and collections capped at 100 items, 100 personal notes**. VIP went **$30 → $60/year (+100%)**. New free features added as cover: collaborative lists, a universal "Watch now" filter, personal notes. Community reaction was hostile ("low-key predatory"); Trakt closed the forum threads, which made it worse; users publicly migrated to **Simkl, Letterboxd and Showly**. — https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/
- Neowin reported the change as **"up to a 300% price hike," and specifically that Trakt went back on a promise to honour legacy subscriptions** — legacy $15 and $30/yr subscribers were moved to $60. — https://www.neowin.net/news/trakt-vip-receives-up-to-300-price-hike-going-back-on-promise-to-honor-legacy-subs/
- Current tiering: **VIP $30/yr, VIP Executive Producer $60/yr**, plus a 2-year plan that works out to ~$48/yr; subscribers complain the alternative plans are **hidden from existing subscribers** (you have to cancel to see them). — https://mindbalance.blog/trakt-cost-vip-pricing-guide, https://forums.trakt.tv/t/vip-subscription-plans/122101

**Traction.** **No registered-user count is public.** Trakt has never disclosed one. The only proxy: **11.59M website visits in October 2025** (Semrush) — that's visits, not members. — https://www.semrush.com/website/trakt.tv/overview/

**AI features.** **Essentially none shipped.** The only AI reference is aspirational — Trakt's stated rationale for VIP is that subscribers "provide capital for Trakt to experiment with new features, such as advanced AI recommendations or deep API integrations that require significant compute." The **May 2026 product update contains no AI features, no social features, and no user statistics**; it is entirely V3 platform migration (V3 became the default for VIP by end of June 2026), progress sections, media pages, filters, 20 UI languages. Community sentiment in that thread is frustration at V3 regressions vs V2 (filtering, library management, calendar). — https://forums.trakt.tv/t/trakt-product-update-may-2026/111812

**MULTIPLAYER?** **Weakly multiplayer, and de-prioritised.** Trakt has comments, likes, follows, public lists, and (since Feb 2025) **collaborative lists** — the one genuinely multiplayer primitive in this set. But the product roadmap through 2026 is entirely single-player infrastructure: progress tracking, media pages, filters. It is a **sync layer with a vestigial social graph**, not a social product. Nobody opens Trakt to see what their friends watched.

---

## 4. Simkl

**What it is.** A cross-media tracker covering **TV, movies AND anime** (anime is its real differentiator versus Trakt/Serializd), with automatic scrobbling, "how many episodes you missed" catch-up, next-up recommendations, import from other services, apps on iOS/Android/web/Plex/Kodi, browser extensions for Chrome and Edge, and a public API. Company listed as based in New York, NY.
- https://simkl.com/
- https://docs.simkl.org/how-to-use-simkl
- https://www.cbinsights.com/company/simkl

**Ownership / funding.** **No funding, founder, or ownership information is public.** Neither CB Insights nor the Simkl docs disclose a founder name, a round, or a company structure. Treat as bootstrapped/anonymous indie.

**Traction.** **No user numbers are public.** Nothing in the docs, the VIP page, or CB Insights. Notable qualitative signal: Simkl was one of the top named destinations for **Trakt defectors after the Feb 2025 price hike** and for **TV Time refugees in July 2026** — it is the incumbent beneficiary of both migrations.

**Monetisation.** Free tier; **Simkl VIP** and **Simkl PRO** paid tiers. Unusual and worth noting: **"PRO is available for free to all members who use Simkl at least 20 days a month"** — i.e. they pay you in features for retention rather than charging for them. — https://docs.simkl.org/how-to-use-simkl/core-features/overview-of-simkl, https://simkl.com/vip/

**AI features.** **Yes — "Personalized AI Recommendations" is an explicitly marketed paid (Pro/VIP) feature**, bundled alongside Year in Review, custom lists, and Beta V2 access. Exact ship date not stated; present in 2025 marketing. — https://simkl.com/vip/featured/

**MULTIPLAYER?** **Yes, more than most — and it markets social as a pillar.** Simkl's own positioning: it "connects you to what your friends are into." Concretely: **Find Friends** (search by email or username), follow users, share watchlists, see what's popular within your social circle, public reviews and ratings, community discussions, curated public lists, and an official **Discord**. Its docs enumerate "Social Users" as a target persona. This is the closest thing in the tracker category to a real friend graph — but it is still **friends-as-a-feed**, not friends-as-a-decision-mechanism. No group picking, no shared "what do we watch."
- https://docs.simkl.org/how-to-use-simkl/about/what-is-simkl/who-is-simkl-for

---

## 5. JustWatch

**What it is.** The world's largest streaming guide — a where-to-watch search engine across 1,100+ streaming services and 470,000+ titles, with watchlists and price/availability tracking. Consumer product is free and ad-supported; the real business is **JustWatch Media**, a B2B arm that monetises the consumer panel three ways: (a) **affiliate commissions**, (b) **licensing where-to-watch data, streaming charts and audience insights** to 1,200+ partner websites/apps and to studios, and (c) running **trailer ad campaigns on YouTube / Meta / TikTok** for Universal, Paramount, Sony, Disney, Prime Video and others using its first-party intent data.
- https://www.justwatch.com/
- https://www.justwatch.com/blog/tags/business-model/
- https://tmbroadcast.com/index.php/justwatch-finding-way-streaming/

**Ownership / funding — notable: deliberately no VC.** Founded **October 2014 in Berlin** by **David Croyé (CEO)** with five co-founders (Christoph Hoyer, Kevin Hiller, Dominik Raute, Ingke Weimert, Michael Wilken), all ex-Berlin-startup operators. Funded with **~$500K of the founders' own money plus ~$2M in public innovation/technology grants and private loans**. They explicitly rejected venture capital — Croyé: *"the best funding is always revenue"* — and reached profitability within a year of client work. **Independent and self-funded today.**
- https://media.justwatch.com/our-story
- Acquisition: **acquired New York rival GoWatchIt from Plexus Entertainment in December 2019** (cash + stock) — https://techcrunch.com/2019/12/09/berlin-based-streaming-guide-justwatch-acquires-new-york-rival-gowatchit/
- Moving up the value chain: hired **Quentin Carbonell** to make its first move into **content licensing** — https://www.screendaily.com/news/streaming-guide-justwatch-takes-first-step-into-content-licensing-with-quentin-carbonell-hire/5212632.article

**Traction (well documented, company-stated, July 2026).**
- **60M+ monthly active users across 140 countries**
- **200+ employees**
- HQ Berlin; offices New York, Los Angeles, Paris, Munich, London (their own-story page also lists Rome and Dubai)
- Publishes a quarterly **Market Shares Report** (Q2 2026 most recent)
- https://www.justwatch.com/us/press/tvtime-migration-tool-launch
- https://www.justwatch.com/us/press

**AI features.** None consumer-facing found.

**MULTIPLAYER? No — fully single-player.** Watchlists are private and personal. There is no friend graph, no following, no shared lists, no reviews, no community. JustWatch is a **utility + data business**, and its social layer is zero. That is deliberate: its asset is the aggregate behavioural panel, not the network.

**Strategically the most aggressive player in 2026:** on **July 3, 2026**, ten days after the TV Time shutdown notice and twelve days before the lights went out, JustWatch shipped a free **TV Time migration tool** that imports viewing history, watchlists and episode tracking (export from gdpr.tvtime.com → upload at justwatch.com/us/tvtime-importer → sync to a JustWatch account). Leonard Brahm, SVP of Platforms: *"TV Time has been one of the most popular ways for fans to track what they watch... We wanted to make sure that history had somewhere to go."* Note what this signals: **JustWatch, a pure where-to-watch utility, is moving into episode-level tracking** to absorb TV Time's corpse.
- https://www.justwatch.com/us/press/tvtime-migration-tool-launch
- https://www.justwatch.com/us/tvtime-importer
- https://9to5mac.com/2026/07/09/as-tv-time-prepares-to-shut-down-justwatch-launches-migration-tool/

---

## 6. Reelgood

**What it is.** A universal streaming guide aggregating 150+ (marketing now says 300+) services into one browse/search/track surface, free to consumers. Increasingly the consumer app is a shop window for **Reelgood for Business** (data.reelgood.com), which sells real-time availability data, 7+ years of historical windowing, metadata/taxonomy (50+ genres, 250+ tags), and production-ready imagery via twice-daily S3 export and APIs.
- https://reelgood.com/
- https://data.reelgood.com/
- https://www.cloudwards.net/how-to-use-reelgood/

**Ownership / funding.** Legal entity **MYFLICKLIST, INC.**, founded 2015, San Francisco, founder/CEO **David Sanderson**. **~$11.3M total raised across 3 rounds**: Seed **April 2, 2015** led by **Harrison Metal**; **$6.75M** round (TechCrunch, 2020); **Series A December 6, 2019**; investors include **August Capital, Harrison Metal, Runa Capital**. Latest recorded round is a **$4.1M debt financing on March 17, 2022** — no equity since. Acquired **Guidebox**. Status **active**, **26 employees as of May 31, 2026**.
- https://tracxn.com/d/companies/reelgood/__6WSNIN6xN2ZIGMbBFYUrjsxd_ieJRonx4psCR9TjMsM
- https://pitchbook.com/profiles/company/118207-00
- https://www.crunchbase.com/organization/myflicklist-com

**Traction.** Consumer numbers are stale and weak. **5 million US users, reported 2020** — https://www.fastcompany.com/90526983/these-two-underdog-apps-have-solved-streaming-tvs-biggest-headache. **No current MAU is public.** iOS app: **750K+ downloads, 4.7★ from ~10,000 ratings, ranks outside the top 30 in US iPhone Entertainment** — https://mwm.ai/apps/reelgood-streaming-guide/1031391869 (third-party analytics page, not official). Reelgood was in a **partial outage as of Aug 24, 2026** but is operating — https://www.entireweb.com/status/reelgood

B2B side is the live business and is scaling: **4M+ titles, 300+ platforms, 25+ countries**, client logos including Google, Apple, Amazon, Disney, Warner Bros, Roku; shipped data-solution updates **Dec 2025** and **March 2026**; recent **partnership with Philo** for content intelligence and personalisation.
- https://data.reelgood.com/ , https://data.reelgood.com/reelgood-streaming-data-solution-updates-dec-2025

**AI features.** Marketing-level only, and B2B: Reelgood describes its title-matching engine as **"AI-powered, 100M users tested"** over eight years, and headlines the data site "TV & Movie metadata. Powered by AI." No consumer-facing AI feature found.

**MULTIPLAYER? No — fully single-player.** Personal tracking, personal alerts for new episodes and new arrivals, no account needed to browse. No friends, no following, no shared lists, no reviews, no community. **Verdict: quietly transitioning from a consumer app into a data vendor.** The consumer product looks like maintenance-mode top-of-funnel.

---

## 7. Plex — Discover Together, social layer, and the 2025/2026 pricing shock

**What it is.** Personal-media server company that has spent 2023–2026 bolting a **cross-service discovery and social network** on top of the server business — explicitly positioning itself as a "cross-service discovery hub" and openly targeting **Letterboxd and TV Time** as competitors.

**Ownership / funding.** Private, independent (not re-verified in this pass).

**Traction — best-documented in the set.**
- **42 million monthly active users across 180+ countries/territories** (June 2026) — https://techcrunch.com/2026/06/03/plex-launches-new-social-features-amid-a-major-price-hike/
- **100M+ monthly viewing decisions** and **45 million user-created watchlists** — https://alternativeto.net/news/2026/6/plex-introduces-social-lists-community-forums-and-personalized-discovery-features/

**Pricing changes — two hikes in two years.**
- **Effective April 29, 2025:** Plex Pass **monthly $4.99 → $6.99** (+40%), **annual $39.99 → $69.99** (+75%), **lifetime $119.99 → $249.99** (+108%). New **Remote Watch Pass at $1.99/mo or $19.99/yr**. Crucially, **remote streaming of your own media became a paid feature** on that date. The iOS/Android one-time app activation fee was removed and local streaming became free/unlimited. — https://hostbor.com/plex-changes-explained/ , https://www.plex.tv/blog/important-2025-plex-updates/
- **Effective July 1, 2026:** **Lifetime Plex Pass $249.99 → $749.99** — a tripling, and the second hike in ~14 months. — https://www.plex.tv/blog/new-lifetime-plex-pass-pricing/ , https://techcrunch.com/2026/06/03/plex-launches-new-social-features-amid-a-major-price-hike/

**AI features.** **Match Score** (June 2026) — a personalised percentage prediction of how much you'll enjoy a title, computed from your ratings and viewing habits; Plex says it takes "the guesswork out of discovery." Also **AI + human moderation** on the new Discussions forums. No conversational/LLM feature.

**MULTIPLAYER? Yes — the most aggressively multiplayer product in this entire report, and getting more so every release.** Timeline:
- **November 2023 — "Discover Together":** create a profile, find and follow friends, see friends' watchlists and activity. Started as a closed family-and-friends network.
- **January 22, 2025:** goes public-facing. **Public shareable profile URLs** (watch.plex.tv), **public reviews on titles**, **commenting on other users' reviews**, and granular visibility controls (anyone / signed-in users / friends / friends-of-friends / private; default for ratings and reviews is **Friends**). TechCrunch framed it explicitly as competing with Letterboxd and TV Time. — https://techcrunch.com/2025/01/22/streaming-service-plex-gets-more-social-with-public-profiles-and-reviews
- **June 3, 2026 — four new social features at once:** **Lists** (create, curate, share lists of movies/shows/individual episodes; **emoji reactions instead of star ratings**; images in reviews; **import from other platforms coming later in 2026**; react and comment on friends' lists coming); **Discussions** (per-title community forums, explicitly aimed at Reddit and Letterboxd, with AI + human moderation); **Match Score**; **Alerts** (notifications for activity on followed lists, shows, and people). — https://techcrunch.com/2026/06/03/plex-launches-new-social-features-amid-a-major-price-hike/ , https://alternativeto.net/news/2026/6/plex-introduces-social-lists-community-forums-and-personalized-discovery-features/

**Read on this:** Plex is racing toward exactly the social-taste-graph territory a social movie/TV app would occupy, it has 42M MAU to seed it with, and it is doing so *while* torching goodwill with a 3× price hike — community response to the social features was widely characterised as skeptical, "damage control," insufficient compensation for the price rise. The opening is that Plex's social layer is welded to a server/self-hoster product with a hostile pricing story, and **still has no group-decision mechanic** — it is lists, reviews, forums and follows, i.e. broadcast again.

---

## 8. Netflix — first-party social + AI

**What it is.** N/A as a competitor product, relevant as platform risk: Netflix is building discovery and light social directly into the viewing surface.

**AI — the OpenAI conversational search beta.**
- Announced **May 7, 2025** alongside a full TV homepage overhaul. Built **in partnership with OpenAI**, combining OpenAI's base model with Netflix's proprietary content and member data. Natural-language queries: *"I want something funny and upbeat"*, *"I want something scary, but not too scary, and maybe a little bit funny, but not haha funny."*
- Rollout: **opt-in beta, iOS only**, first trialled in **Australia and New Zealand**, then the US and further markets. **No Android rollout planned** as of reporting. As of 2026 it remains in limited release rather than global GA.
- Also announced: AI-personalised artwork, **real-time in-session recommendations** responding to "moods and interests in the moment," and generative-AI title-card translations.
- https://techcrunch.com/2025/05/07/netflix-debuts-its-generative-ai-powered-search-tool/
- https://www.cnbc.com/2025/05/07/netflix-homepage-app-revamp-openai-tool.html
- https://www.whats-on-netflix.com/news/netflix-unveils-tv-interface-overhaul-with-new-search-powered-by-openai-and-tiktok-style-feed/

**Social features.**
- **Moments** (launched 2024, expanding through 2025-26): save a clip from anything you're watching, and **share it with friends**. Netflix's own disclosed stat: the top-saved Moment is a kiss scene from *Arcane* season 2.
- **Vertical TikTok-style feed** on mobile — evolved from "Fast Laughs" (2021), relaunched across the **full Netflix library**, rolled out globally on mobile over the weeks following May 2025, built expressly for "mobile watching and **sharing**."
- New TV UI: top nav with five tabs, a **"My Netflix"** tab, larger title cards, reviews/Top-10 callouts, dynamic colour theming, live-event optimisation (WWE/NFL).

**MULTIPLAYER? Barely — outbound sharing only.** There is **no friend graph inside Netflix**. Moments and the vertical feed let you export a clip to other people via other platforms. There are no friends, no follows, no shared lists, no profiles-as-social-objects. Netflix's "social" is **virality plumbing, not a network**. Also relevant: Netflix's AI search is a **single-player** conversational recommender — it answers "what should *I* watch," never "what should *we* watch."

---

## 9. Apple TV app

**What it is.** Apple's aggregated viewing surface — Up Next, cross-service catalogue including Peacock, HBO Max, Prime Video, Disney+ and other Apple-TV-app-compatible services, per-profile personalisation.

**Ownership / traction.** Apple. **No Apple TV *app* user numbers are published** — Apple does not break these out.

**AI features.**
- **Genius Browse**, shipped in **tvOS 26.4, released Tuesday March 24, 2026** (reported March 17–18, 2026). Adds a row of vibe-based discovery categories on the Apple TV app Home tab — example categories: *Upbeat Workplace Comedies, Tense Psychological Thrillers, History Gets Hilarious, Breathtaking Nature Docs, Thrilling Blockbusters, Bittersweet Family Dramas, Fun for the Whole Family*. Each featured title opens another layer of title-specific recommendations. It is **personalised per profile** and **spans third-party services, not just Apple TV+**. **tvOS only** — deliberately not in iOS/iPadOS/macOS 26.4. Same release removed the iTunes Movies and TV Shows apps.
  - https://www.macrumors.com/2026/03/18/tvos-26-4-genius-browse-mode/
  - https://www.macrumors.com/2026/03/24/apple-releases-tvos-26-4/
  - https://9to5mac.com/2026/03/17/tvos-26-4-adds-powerful-new-genius-feature-for-apple-tv-4k/
- **Coming:** next-gen **Siri AI** (internal codename *"campo"*) expected in **tvOS 27 in fall 2026**, with a new **Apple TV 4K** hardware refresh in fall 2026; a "Siri" entry has appeared in the tvOS 27 app list. 9to5Mac's framing is that Apple's AI play here will look like **Netflix's conversational search**. All still rumour/beta-signal, not shipped.
  - https://appleinsider.com/articles/26/08/19/what-to-expect-from-the-2026-apple-tv-4k-siri-ai-siri-remote-better-networking-more
  - https://9to5mac.com/2026/05/07/new-apple-tv-4k-adding-ai-might-look-like-this-netflix-feature/
  - https://www.flatpanelshd.com/news.php?subaction=showfull&id=1782216188

**MULTIPLAYER? No — zero social layer.** Explicitly confirmed: the tvOS 26.4 coverage contains **no mention of any social features** in the Apple TV app. There are no friends, no follows, no reviews, no shared lists, no public profiles. Apple's discovery bet is **taste-modelled single-player**, with SharePlay as the only co-viewing primitive anywhere in the stack.

---

## SYNTHESIS FOR A SOCIAL MOVIE/TV TASTE APP

**1. The multiplayer axis is almost entirely empty, and that is the finding.**

| Product | Social graph | Reviews/comments | Shared/collab lists | **Group decision ("what do WE watch")** |
|---|---|---|---|---|
| Serializd | follows (no real feed) | yes | no | **no** |
| TV Time | yes (large) | yes | no | **no** — *and dead since Jul 2026* |
| Trakt | follows, likes | yes | **yes** (collab lists, Feb 2025) | **no** |
| Simkl | **find friends, follow, Discord** | yes | public lists | **no** |
| JustWatch | none | none | none | **no** |
| Reelgood | none | none | none | **no** |
| Plex | **follows, public profiles, forums** | yes | **yes** (Lists, reactions) | **no** |
| Netflix | none (outbound share only) | none | none | **no** |
| Apple TV | none | none | none | **no** |

Every single one is broadcast-social at best. **Not one product in this landscape solves the group decision.** Every social layer built in 2025–2026 — Plex Lists, Plex Discussions, Trakt collaborative lists, Serializd follows — is "publish my taste so others can read it." Nobody has built "three of us are on the couch, pick."

**2. A 25M-user vacuum just opened, in July 2026.** TV Time's death is the defining event of this market. The incumbents' response has been **import tooling** (JustWatch's migration tool, Trakt/Simkl/Serializd/Moviebase positioning as alternatives), i.e. competing for the corpse on the axis of *data portability*, not on product. Whoever offers the best import path plus something TV Time never had wins those users. **Letterboxd-for-TV import is table stakes; JustWatch already shipped it.**

**3. The economics of the category are visibly brutal — which is a warning, not just an opportunity.** TV Time died because "there was not enough demand for a paid app" even at ~25M users. Trakt raised VIP 100–300% in Feb 2025 and broke a legacy-pricing promise because subscriptions are its only revenue. Plex hiked lifetime 108% in 2025 then 200% again in 2026. Reelgood has taken no equity since 2019 and is migrating to B2B data. **The two profitable models in this set are (a) JustWatch — free consumer panel, monetised as B2B data + affiliate + ad buying, 60M MAU, 200 staff, never took VC, and (b) Reelgood's data arm.** Consumer subscription for a tracker is a demonstrated graveyard.

**4. AI in this category is shallow and mostly single-player.** Netflix (OpenAI conversational search, May 2025, still iOS-only opt-in beta), Apple (Genius Browse, tvOS-only, March 2026, vibe categories not conversation), Plex (Match Score, a percentage), Simkl (paywalled "AI recommendations"), Trakt (talks about AI, ships none), Serializd/JustWatch/Reelgood-consumer (nothing). **Nobody has shipped a conversational, graph-aware, multi-person recommender.** The AI everyone built answers "what should I watch"; none of it answers "what should we watch," and none of it reasons over an actual entity graph of who-was-in-what-with-whom.

**5. Plex is the competitor to watch.** 42M MAU, 45M watchlists, an explicit "cross-service discovery hub" strategy, and a social feature cadence accelerating through 2026 — while simultaneously alienating its base with a 3× price hike and being structurally tethered to a self-hosting product. That is a large, distracted, unpopular incumbent moving toward the same ground.

---

### Sources

[TechCrunch — TV Time shutting down (Jul 2 2026)](https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/) · [Wikipedia — Whip Media](https://en.wikipedia.org/wiki/Whip_Media) · [Wikipedia — TV Time](https://en.wikipedia.org/wiki/TV_Time) · [Whip Media — TV Time 20M users](https://whipmedia.com/news/tv-time-hits-new-milestone-with-20-million-registered-users/) · [Moviebase — TV Time shutting down](https://moviebase.app/resources/tv-time-shutting-down) · [Serializd About](https://www.serializd.com/about) · [Serializd App Store](https://apps.apple.com/us/app/serializd/id1581244120) · [Serializd Product Hunt](https://www.producthunt.com/products/serializd) · [Similarweb — Serializd Android](https://www.similarweb.com/app/google/com.serializdmobile/) · [ResetEra — TV logging thread](https://www.resetera.com/threads/the-tv-logging-app-service-letterboxd-you%E2%80%99ve-been-waiting-for-is-finally-here.548255/) · [AlternativeTo — Trakt limits + VIP hike (Feb 2025)](https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/) · [Neowin — Trakt VIP up to 300% hike](https://www.neowin.net/news/trakt-vip-receives-up-to-300-price-hike-going-back-on-promise-to-honor-legacy-subs/) · [Trakt Forums — May 2026 product update](https://forums.trakt.tv/t/trakt-product-update-may-2026/111812) · [Trakt Forums — VIP subscription plans](https://forums.trakt.tv/t/vip-subscription-plans/122101) · [Trakt VIP pricing guide](https://mindbalance.blog/trakt-cost-vip-pricing-guide) · [Semrush — trakt.tv traffic](https://www.semrush.com/website/trakt.tv/overview/) · [Simkl docs — overview](https://docs.simkl.org/how-to-use-simkl/core-features/overview-of-simkl) · [Simkl docs — who it's for](https://docs.simkl.org/how-to-use-simkl/about/what-is-simkl/who-is-simkl-for) · [Simkl VIP/Pro plans](https://simkl.com/vip/) · [Simkl testimonials](https://simkl.com/vip/featured/) · [CB Insights — Simkl](https://www.cbinsights.com/company/simkl) · [JustWatch press — TV Time migration tool (Jul 3 2026)](https://www.justwatch.com/us/press/tvtime-migration-tool-launch) · [JustWatch TV Time importer](https://www.justwatch.com/us/tvtime-importer) · [JustWatch — Our Story](https://media.justwatch.com/our-story) · [JustWatch press room](https://www.justwatch.com/us/press) · [JustWatch blog — business model](https://www.justwatch.com/blog/tags/business-model/) · [9to5Mac — JustWatch migration tool](https://9to5mac.com/2026/07/09/as-tv-time-prepares-to-shut-down-justwatch-launches-migration-tool/) · [TechCrunch — JustWatch acquires GoWatchIt (2019)](https://techcrunch.com/2019/12/09/berlin-based-streaming-guide-justwatch-acquires-new-york-rival-gowatchit/) · [Screen Daily — JustWatch content licensing hire](https://www.screendaily.com/news/streaming-guide-justwatch-takes-first-step-into-content-licensing-with-quentin-carbonell-hire/5212632.article) · [TM Broadcast — JustWatch interview](https://tmbroadcast.com/index.php/justwatch-finding-way-streaming/) · [Tracxn — Reelgood profile](https://tracxn.com/d/companies/reelgood/__6WSNIN6xN2ZIGMbBFYUrjsxd_ieJRonx4psCR9TjMsM) · [PitchBook — Reelgood](https://pitchbook.com/profiles/company/118207-00) · [Crunchbase — Reelgood/MyFlickList](https://www.crunchbase.com/organization/myflicklist-com) · [Reelgood for Business](https://data.reelgood.com/) · [Reelgood data updates Dec 2025](https://data.reelgood.com/reelgood-streaming-data-solution-updates-dec-2025) · [Fast Company — Reelgood 5M users](https://www.fastcompany.com/90526983/these-two-underdog-apps-have-solved-streaming-tvs-biggest-headache) · [MWM — Reelgood app stats](https://mwm.ai/apps/reelgood-streaming-guide/1031391869) · [TechCrunch — Plex social features + price hike (Jun 3 2026)](https://techcrunch.com/2026/06/03/plex-launches-new-social-features-amid-a-major-price-hike/) · [TechCrunch — Plex public profiles & reviews (Jan 22 2025)](https://techcrunch.com/2025/01/22/streaming-service-plex-gets-more-social-with-public-profiles-and-reviews) · [AlternativeTo — Plex social lists & forums](https://alternativeto.net/news/2026/6/plex-introduces-social-lists-community-forums-and-personalized-discovery-features/) · [Plex — New Lifetime Plex Pass Pricing](https://www.plex.tv/blog/new-lifetime-plex-pass-pricing/) · [Plex — Important 2025 Updates](https://www.plex.tv/blog/important-2025-plex-updates/) · [Hostbor — Plex 2025 pricing breakdown](https://hostbor.com/plex-changes-explained/) · [StreamTV Insider — Plex raises prices](https://www.streamtvinsider.com/video/plex-raises-prices-plans-updates) · [TechCrunch — Netflix gen-AI search (May 7 2025)](https://techcrunch.com/2025/05/07/netflix-debuts-its-generative-ai-powered-search-tool/) · [CNBC — Netflix homepage revamp + OpenAI](https://www.cnbc.com/2025/05/07/netflix-homepage-app-revamp-openai-tool.html) · [What's on Netflix — TV interface overhaul](https://www.whats-on-netflix.com/news/netflix-unveils-tv-interface-overhaul-with-new-search-powered-by-openai-and-tiktok-style-feed/) · [MacRumors — Genius Browse in tvOS 26.4](https://www.macrumors.com/2026/03/18/tvos-26-4-genius-browse-mode/) · [MacRumors — tvOS 26.4 release](https://www.macrumors.com/2026/03/24/apple-releases-tvos-26-4/) · [9to5Mac — tvOS 26.4 Genius](https://9to5mac.com/2026/03/17/tvos-26-4-adds-powerful-new-genius-feature-for-apple-tv-4k/) · [AppleInsider — 2026 Apple TV 4K expectations](https://appleinsider.com/articles/26/08/19/what-to-expect-from-the-2026-apple-tv-4k-siri-ai-siri-remote-better-networking-more) · [9to5Mac — Apple TV AI like Netflix](https://9to5mac.com/2026/05/07/new-apple-tv-4k-adding-ai-might-look-like-this-netflix-feature/) · [Cloudwards — How to use Reelgood 2026](https://www.cloudwards.net/how-to-use-reelgood/)
